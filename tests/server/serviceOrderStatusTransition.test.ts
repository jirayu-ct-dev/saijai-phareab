import { describe, expect, it, vi } from "vitest";
import {
  canTransitionServiceOrderStatus,
  getAllowedServiceOrderTransitions,
} from "../../server/utils/serviceOrderStatusTransition";
import {
  deductAddonUsageRecords,
  refundAddonUsages,
  refundPrimaryCredit,
} from "../../server/utils/serviceOrderCredits";

describe("service-order status transitions", () => {
  it("allows RECEIVED -> PROCESSING -> DELIVERING -> COMPLETED", () => {
    expect(canTransitionServiceOrderStatus("RECEIVED", "PROCESSING")).toBe(true);
    expect(canTransitionServiceOrderStatus("PROCESSING", "DELIVERING")).toBe(true);
    expect(canTransitionServiceOrderStatus("DELIVERING", "COMPLETED")).toBe(true);
  });

  it("refunds primary credit and deducted add-on credit when cancelled", async () => {
    const tx = {
      memberEntitlement: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      serviceOrderAddonUsage: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "addon-usage-1",
            memberEntitlementId: "addon-entitlement-1",
            credits: 2,
          },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    await refundPrimaryCredit(tx as never, {
      memberEntitlementId: "primary-entitlement-1",
      creditUsed: 3,
    });
    await refundAddonUsages(tx as never, "order-1", []);

    expect(tx.memberEntitlement.updateMany).toHaveBeenCalledWith({
      where: { id: "primary-entitlement-1" },
      data: { creditRemaining: { increment: 3 } },
    });
    expect(tx.memberEntitlement.updateMany).toHaveBeenCalledWith({
      where: { id: "addon-entitlement-1" },
      data: { creditRemaining: { increment: 2 } },
    });
    expect(tx.serviceOrderAddonUsage.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["addon-usage-1"] } },
      data: { refundedAt: expect.any(Date) },
    });
  });

  it("deducts COMPLETED add-on credit only once", async () => {
    let deducted = false;
    const tx = {
      memberEntitlement: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      serviceOrderAddonUsage: {
        findMany: vi.fn().mockImplementation(async () => {
          if (deducted) return [];
          return [
            {
              id: "addon-usage-1",
              serviceOrderId: "order-1",
              memberEntitlementId: "addon-entitlement-1",
              productId: "addon-product-1",
              productName: "แพ็กเกจเสริม",
              credits: 2,
              deductOn: "COMPLETED",
              memberEntitlement: {
                product: { name: "แพ็กเกจเสริม" },
              },
            },
          ];
        }),
        update: vi.fn().mockImplementation(async () => {
          deducted = true;
          return {};
        }),
      },
    };

    const first = await deductAddonUsageRecords(tx as never, "order-1", "COMPLETED");
    const second = await deductAddonUsageRecords(tx as never, "order-1", "COMPLETED");

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
    expect(tx.memberEntitlement.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.memberEntitlement.updateMany).toHaveBeenCalledWith({
      where: {
        id: "addon-entitlement-1",
        status: "ACTIVE",
        deletedAt: null,
        creditRemaining: { gte: 2 },
      },
      data: { creditRemaining: { decrement: 2 } },
    });
  });

  it("rejects invalid status jumps such as RECEIVED -> COMPLETED", () => {
    expect(canTransitionServiceOrderStatus("RECEIVED", "COMPLETED")).toBe(false);
    expect(getAllowedServiceOrderTransitions("RECEIVED")).toEqual(["PROCESSING", "CANCELLED"]);
  });
});
