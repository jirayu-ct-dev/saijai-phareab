import { describe, expect, it, vi } from "vitest";
import {
  canTransitionServiceOrderStatus,
  getAllowedServiceOrderTransitions,
  resolveServiceOrderCompletedAt,
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
            deductedAt: new Date("2026-05-01T00:00:00.000Z"),
            refundedAt: null,
          },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    await refundPrimaryCredit(tx as never, {
      memberEntitlementId: "primary-entitlement-1",
      creditUsed: 3,
    });
    await refundAddonUsages(tx as never, "order-1");

    expect(tx.memberEntitlement.updateMany).toHaveBeenCalledWith({
      where: { id: "primary-entitlement-1", deletedAt: null, creditRemaining: { not: null } },
      data: { creditRemaining: { increment: 3 } },
    });
    expect(tx.memberEntitlement.updateMany).toHaveBeenCalledWith({
      where: { id: "addon-entitlement-1", deletedAt: null, creditRemaining: { not: null } },
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

  it("stamps the exact first transition into COMPLETED", () => {
    const transitionAt = new Date("2026-09-02T04:30:00.000Z");

    expect(resolveServiceOrderCompletedAt({
      fromStatus: "DELIVERING",
      toStatus: "COMPLETED",
      currentCompletedAt: null,
      transitionAt,
    })).toBe(transitionAt);
  });

  it("preserves legacy null and an existing timestamp when COMPLETED is edited without a transition", () => {
    const transitionAt = new Date("2026-09-02T04:30:00.000Z");
    const completedAt = new Date("2026-09-01T04:30:00.000Z");

    expect(resolveServiceOrderCompletedAt({
      fromStatus: "COMPLETED",
      toStatus: "COMPLETED",
      currentCompletedAt: null,
      transitionAt,
    })).toBeNull();
    expect(resolveServiceOrderCompletedAt({
      fromStatus: "COMPLETED",
      toStatus: "COMPLETED",
      currentCompletedAt: completedAt,
      transitionAt,
    })).toBe(completedAt);
  });

  it("stamps an order created directly as COMPLETED and leaves other new orders null", () => {
    const transitionAt = new Date("2026-09-02T04:30:00.000Z");

    expect(resolveServiceOrderCompletedAt({
      fromStatus: null,
      toStatus: "COMPLETED",
      currentCompletedAt: null,
      transitionAt,
    })).toBe(transitionAt);
    expect(resolveServiceOrderCompletedAt({
      fromStatus: null,
      toStatus: "RECEIVED",
      currentCompletedAt: null,
      transitionAt,
    })).toBeNull();
  });
});
