/**
 * Add-on credit ledger tests.
 *
 * Originated as DB-01 characterization tests; the double-refund quirk they
 * pinned is now a regression test of the correct DB-04 behavior:
 *   - deduction/refund work through normalized ServiceOrderAddonUsage records.
 *   - normalized records are the only runtime source of add-on usage.
 *   - pending (not yet deducted) usages are voided without touching balances.
 *
 * The transaction client is an in-memory fake; `createError` is shimmed to the
 * h3 contract (error objects carrying statusCode/statusMessage) because Nitro
 * auto-imports it at runtime.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deductAddonUsageRecords,
  parseAddonUsages,
  refundAddonUsages,
  refundPrimaryCredit,
  voidPendingAddonUsageRecords,
} from "../../server/utils/serviceOrderCredits";

// Shim the Nitro auto-import used inside serviceOrderCredits.ts. It must be
// installed before the functions that throw run.
(globalThis as Record<string, unknown>).createError = (input: { statusCode?: number; statusMessage?: string } = {}) =>
  Object.assign(new Error(input.statusMessage ?? "H3Error"), input);

const tx = () => ({
  memberEntitlement: {
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  serviceOrderAddonUsage: {
    findMany: vi.fn().mockResolvedValue([]),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
});

type UsageRecord = {
  id: string;
  memberEntitlementId: string;
  credits: number;
  deductedAt: Date | null;
  refundedAt: Date | null;
};

const usageRecord = (overrides: Partial<UsageRecord> = {}): UsageRecord => ({
  id: "usage-1",
  memberEntitlementId: "ent-1",
  credits: 2,
  deductedAt: new Date("2026-05-01T00:00:00.000Z"),
  refundedAt: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("parseAddonUsages (legacy JSON shape)", () => {
  it("passes through valid legacy usage entries", () => {
    expect(
      parseAddonUsages([
        {
          entitlementId: "ent-1",
          productId: "prod-1",
          productName: "ซักเสื้อเพิ่ม",
          credits: 3,
          deductOn: "COMPLETED",
          isDelivery: true,
          appliedAt: "2026-05-01T00:00:00.000Z",
          deductedAt: "2026-05-02T00:00:00.000Z",
          refundedAt: "2026-05-03T00:00:00.000Z",
        },
      ]),
    ).toEqual([
      {
        entitlementId: "ent-1",
        productId: "prod-1",
        productName: "ซักเสื้อเพิ่ม",
        credits: 3,
        deductOn: "COMPLETED",
        isDelivery: true,
        appliedAt: "2026-05-01T00:00:00.000Z",
        deductedAt: "2026-05-02T00:00:00.000Z",
        refundedAt: "2026-05-03T00:00:00.000Z",
      },
    ]);
    // Quirk: a null refundedAt in the JSON is not a string, so it is dropped
    // to undefined rather than preserved as null.
    expect(parseAddonUsages([{ entitlementId: "ent-1", credits: 1, refundedAt: null }])).toEqual([
      expect.objectContaining({ refundedAt: undefined }),
    ]);
  });

  it("defaults unknown deductOn values to CREATED", () => {
    // Quirk: only "COMPLETED" is recognized; anything else (including typos
    // and undefined) silently becomes CREATED.
    const [missing] = parseAddonUsages([{ entitlementId: "ent-1", credits: 1 }]) as Array<{ deductOn: string }>;
    const [typo] = parseAddonUsages([{ entitlementId: "ent-1", credits: 1, deductOn: "COMPLETE" }]) as Array<{
      deductOn: string;
    }>;
    expect(missing.deductOn).toBe("CREATED");
    expect(typo.deductOn).toBe("CREATED");
  });

  it("drops entries without an entitlement or with non-positive credits", () => {
    expect(parseAddonUsages([{ entitlementId: "", credits: 2 }])).toEqual([]);
    expect(parseAddonUsages([{ entitlementId: "ent-1", credits: 0 }])).toEqual([]);
    expect(parseAddonUsages([{ entitlementId: "ent-1", credits: -1 }])).toEqual([]);
    expect(parseAddonUsages([{ entitlementId: "ent-1", credits: "3" }])).toEqual([
      expect.objectContaining({ entitlementId: "ent-1", credits: 3 }),
    ]);
  });

  it("returns an empty list for null, non-array, or garbage JSON", () => {
    expect(parseAddonUsages(null)).toEqual([]);
    expect(parseAddonUsages(undefined)).toEqual([]);
    expect(parseAddonUsages("not-an-array")).toEqual([]);
    expect(parseAddonUsages([{ nope: true }, null, 42])).toEqual([]);
  });
});

describe("deductAddonUsageRecords (normalized deduction)", () => {
  it.each([true, false])("allows an expired pending add-on only for a recorded historical intake: %s", async (isHistorical) => {
    const fakeTx = { ...tx(), serviceOrder: { findFirst: vi.fn().mockResolvedValue(isHistorical ? { receivedAt: new Date("2026-09-01T02:00:00Z") } : null) } };
    fakeTx.serviceOrderAddonUsage.findMany.mockResolvedValue([{
      id: "usage-1", memberEntitlementId: "ent-1", credits: 1,
      deductOn: "COMPLETED", productName: "รับส่ง", isDelivery: true,
      memberEntitlement: { status: "EXPIRED", product: { name: "รับส่ง" } },
    }]);
    if (!isHistorical) fakeTx.memberEntitlement.updateMany.mockResolvedValue({ count: 0 });
    if (isHistorical) {
      await deductAddonUsageRecords(fakeTx as never, "order-1", "COMPLETED");
      expect(fakeTx.memberEntitlement.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ status: { in: ["ACTIVE", "EXPIRED"] }, creditRemaining: { gte: 1 }, AND: expect.arrayContaining([{ OR: [{ endAt: null }, { endAt: { gte: new Date("2026-09-01T02:00:00Z") } }] }]) }),
        data: { creditRemaining: { decrement: 1 } },
      });
    } else {
      await expect(deductAddonUsageRecords(fakeTx as never, "order-1", "COMPLETED")).rejects.toMatchObject({ statusCode: 409 });
      expect(fakeTx.serviceOrderAddonUsage.update).not.toHaveBeenCalled();
    }
  });

  it("decrements the entitlement and stamps deductedAt only for matching pending usages", async () => {
    const fakeTx = tx();
    fakeTx.serviceOrderAddonUsage.findMany.mockResolvedValue([
      {
        id: "usage-1",
        memberEntitlementId: "ent-1",
        credits: 2,
        deductOn: "CREATED",
        isDelivery: false,
        productId: "prod-1",
        productName: null,
        memberEntitlement: { product: { name: "แพ็กเกจ A" } },
      },
    ]);

    const deducted = await deductAddonUsageRecords(fakeTx as never, "order-1", "CREATED");

    expect(fakeTx.serviceOrderAddonUsage.findMany).toHaveBeenCalledWith({
      where: {
        serviceOrderId: "order-1",
        deductOn: "CREATED",
        deductedAt: null,
        refundedAt: null,
        credits: { gt: 0 },
      },
      include: { memberEntitlement: { include: { product: { select: { name: true } } } } },
    });
    expect(fakeTx.memberEntitlement.updateMany).toHaveBeenCalledWith({
      where: { id: "ent-1", status: "ACTIVE", deletedAt: null, creditRemaining: { gte: 2 } },
      data: { creditRemaining: { decrement: 2 } },
    });
    expect(fakeTx.serviceOrderAddonUsage.update).toHaveBeenCalledWith({
      where: { id: "usage-1" },
      data: { deductedAt: expect.any(Date) },
    });
    expect(deducted).toEqual([
      expect.objectContaining({
        entitlementId: "ent-1",
        productName: "แพ็กเกจ A",
        credits: 2,
        deductOn: "CREATED",
      }),
    ]);
  });

  it("refuses to deduct when the entitlement cannot cover the credits (409)", async () => {
    const fakeTx = tx();
    fakeTx.serviceOrderAddonUsage.findMany.mockResolvedValue([
      {
        id: "usage-1",
        memberEntitlementId: "ent-1",
        credits: 5,
        deductOn: "CREATED",
        isDelivery: false,
        productId: null,
        productName: null,
        memberEntitlement: { product: { name: "แพ็กเกจ B" } },
      },
    ]);
    fakeTx.memberEntitlement.updateMany.mockResolvedValue({ count: 0 });

    await expect(deductAddonUsageRecords(fakeTx as never, "order-1", "CREATED")).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(fakeTx.serviceOrderAddonUsage.update).not.toHaveBeenCalled();
  });

  it("throws 409 when a usage row lost its entitlement link", async () => {
    const fakeTx = tx();
    fakeTx.serviceOrderAddonUsage.findMany.mockResolvedValue([
      {
        id: "usage-1",
        memberEntitlementId: "ent-1",
        credits: 1,
        deductOn: "CREATED",
        isDelivery: false,
        memberEntitlement: null,
      },
    ]);

    await expect(deductAddonUsageRecords(fakeTx as never, "order-1", "CREATED")).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("returns an empty list without any writes when nothing is pending", async () => {
    const fakeTx = tx();
    fakeTx.serviceOrderAddonUsage.findMany.mockResolvedValue([]);

    await expect(deductAddonUsageRecords(fakeTx as never, "order-1", "COMPLETED")).resolves.toEqual([]);
    expect(fakeTx.memberEntitlement.updateMany).not.toHaveBeenCalled();
  });
});

describe("refundAddonUsages (normalized ledger is the only source)", () => {
  it("refunds deducted usage records and marks them refunded", async () => {
    const fakeTx = tx();
    fakeTx.serviceOrderAddonUsage.findMany.mockResolvedValue([usageRecord({ credits: 2 })]);

    const outcome = await refundAddonUsages(fakeTx as never, "order-1");

    expect(outcome).toBe("normalized");
    expect(fakeTx.serviceOrderAddonUsage.findMany).toHaveBeenCalledWith({
      where: { serviceOrderId: "order-1" },
      select: { id: true, memberEntitlementId: true, credits: true, deductedAt: true, refundedAt: true },
    });
    expect(fakeTx.memberEntitlement.updateMany).toHaveBeenCalledTimes(1);
    expect(fakeTx.memberEntitlement.updateMany).toHaveBeenCalledWith({
      where: { id: "ent-1", deletedAt: null, creditRemaining: { not: null } },
      data: { creditRemaining: { increment: 2 } },
    });
    expect(fakeTx.serviceOrderAddonUsage.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["usage-1"] } },
      data: { refundedAt: expect.any(Date) },
    });
  });

  it("reports no-usage when the order has no ledger rows", async () => {
    const fakeTx = tx();
    fakeTx.serviceOrderAddonUsage.findMany.mockResolvedValue([]);

    const outcome = await refundAddonUsages(fakeTx as never, "order-1");

    expect(outcome).toBe("no-usage");
    expect(fakeTx.memberEntitlement.updateMany).not.toHaveBeenCalled();
  });

  it("does not refund ledger rows twice", async () => {
    const fakeTx = tx();
    fakeTx.serviceOrderAddonUsage.findMany.mockResolvedValue([
      usageRecord({ id: "usage-1", credits: 2, refundedAt: new Date("2026-05-02T00:00:00.000Z") }),
    ]);

    const outcome = await refundAddonUsages(fakeTx as never, "order-1");

    expect(outcome).toBe("already-refunded");
    expect(fakeTx.memberEntitlement.updateMany).not.toHaveBeenCalled();
    expect(fakeTx.serviceOrderAddonUsage.updateMany).not.toHaveBeenCalled();
  });

  it("does not refund a pending usage that was never deducted", async () => {
    const fakeTx = tx();
    fakeTx.serviceOrderAddonUsage.findMany.mockResolvedValue([
      usageRecord({ id: "usage-1", credits: 2, deductedAt: null }),
    ]);

    const outcome = await refundAddonUsages(fakeTx as never, "order-1");

    expect(outcome).toBe("already-refunded");
    expect(fakeTx.memberEntitlement.updateMany).not.toHaveBeenCalled();
  });

  it("fails closed without marking a normalized usage refunded when its entitlement is unavailable", async () => {
    const fakeTx = tx();
    fakeTx.serviceOrderAddonUsage.findMany.mockResolvedValue([usageRecord()]);
    fakeTx.memberEntitlement.updateMany.mockResolvedValue({ count: 0 });

    await expect(refundAddonUsages(fakeTx as never, "order-1")).rejects.toMatchObject({ statusCode: 409 });
    expect(fakeTx.serviceOrderAddonUsage.updateMany).not.toHaveBeenCalled();
  });
});

describe("refundPrimaryCredit", () => {
  it("refunds the order's primary credit back to the entitlement", async () => {
    const fakeTx = tx();
    await refundPrimaryCredit(fakeTx as never, { memberEntitlementId: "ent-1", creditUsed: 3 });
    expect(fakeTx.memberEntitlement.updateMany).toHaveBeenCalledWith({
      where: { id: "ent-1", deletedAt: null, creditRemaining: { not: null } },
      data: { creditRemaining: { increment: 3 } },
    });
  });

  it("is a no-op without an entitlement or with non-positive credits", async () => {
    const fakeTx = tx();
    await refundPrimaryCredit(fakeTx as never, { memberEntitlementId: null, creditUsed: 3 });
    await refundPrimaryCredit(fakeTx as never, { memberEntitlementId: "ent-1", creditUsed: null });
    await refundPrimaryCredit(fakeTx as never, { memberEntitlementId: "ent-1", creditUsed: 0 });
    expect(fakeTx.memberEntitlement.updateMany).not.toHaveBeenCalled();
  });

  it("fails closed when the entitlement cannot receive the refund", async () => {
    const fakeTx = tx();
    fakeTx.memberEntitlement.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      refundPrimaryCredit(fakeTx as never, { memberEntitlementId: "missing-ent", creditUsed: 1 }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("voidPendingAddonUsageRecords", () => {
  it("stamps refundedAt only on pending usages, so voiding never refunds a balance", async () => {
    const fakeTx = tx();
    await voidPendingAddonUsageRecords(fakeTx as never, "order-1");

    expect(fakeTx.serviceOrderAddonUsage.updateMany).toHaveBeenCalledWith({
      where: { serviceOrderId: "order-1", deductedAt: null, refundedAt: null },
      data: { refundedAt: expect.any(Date) },
    });
    // No entitlement writes: voiding pending usages must not change balances.
    expect(fakeTx.memberEntitlement.updateMany).not.toHaveBeenCalled();
  });
});
