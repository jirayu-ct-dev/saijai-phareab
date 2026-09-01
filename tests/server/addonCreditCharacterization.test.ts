/**
 * DB-01 characterization tests — add-on credit ledger behavior.
 *
 * These tests protect CURRENT behavior before the add-on ledger consolidation:
 *   - deduction/refund work through normalized ServiceOrderAddonUsage records
 *     first; legacy JSON on the order is only a fallback for non-migrated rows.
 *   - a refund must not pay credits back twice.
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
};

const usageRecord = (overrides: Partial<UsageRecord> = {}): UsageRecord => ({
  id: "usage-1",
  memberEntitlementId: "ent-1",
  credits: 2,
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

describe("refundAddonUsages (normalized first, legacy JSON fallback, no double refund)", () => {
  it("refunds deducted usage records and marks them refunded, ignoring legacy JSON", async () => {
    const fakeTx = tx();
    fakeTx.serviceOrderAddonUsage.findMany.mockResolvedValue([usageRecord({ credits: 2 })]);

    await refundAddonUsages(fakeTx as never, "order-1", [
      { entitlementId: "ent-legacy", credits: 99 },
    ]);

    expect(fakeTx.memberEntitlement.updateMany).toHaveBeenCalledTimes(1);
    expect(fakeTx.memberEntitlement.updateMany).toHaveBeenCalledWith({
      where: { id: "ent-1" },
      data: { creditRemaining: { increment: 2 } },
    });
    expect(fakeTx.serviceOrderAddonUsage.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["usage-1"] } },
      data: { refundedAt: expect.any(Date) },
    });
    // The legacy JSON must never be refunded while normalized records exist.
    expect(fakeTx.memberEntitlement.updateMany).not.toHaveBeenCalledWith({
      where: { id: "ent-legacy" },
      data: expect.anything(),
    });
  });

  it("falls back to legacy JSON only when no deducted usage records exist", async () => {
    const fakeTx = tx();
    fakeTx.serviceOrderAddonUsage.findMany.mockResolvedValue([]);

    await refundAddonUsages(fakeTx as never, "order-1", [
      { entitlementId: "ent-legacy", credits: 3 },
      { entitlementId: "ent-legacy-2", credits: 1 },
    ]);

    expect(fakeTx.memberEntitlement.updateMany).toHaveBeenCalledTimes(2);
    expect(fakeTx.memberEntitlement.updateMany).toHaveBeenCalledWith({
      where: { id: "ent-legacy" },
      data: { creditRemaining: { increment: 3 } },
    });
    expect(fakeTx.serviceOrderAddonUsage.updateMany).not.toHaveBeenCalled();
  });

  it("ignores invalid legacy JSON entries during the fallback", async () => {
    const fakeTx = tx();
    fakeTx.serviceOrderAddonUsage.findMany.mockResolvedValue([]);

    await refundAddonUsages(fakeTx as never, "order-1", [
      { entitlementId: "ent-good", credits: 2 },
      { entitlementId: "", credits: 5 },
      { entitlementId: "ent-zero", credits: 0 },
    ]);

    expect(fakeTx.memberEntitlement.updateMany).toHaveBeenCalledTimes(1);
    expect(fakeTx.memberEntitlement.updateMany).toHaveBeenCalledWith({
      where: { id: "ent-good" },
      data: { creditRemaining: { increment: 2 } },
    });
  });

  it("quirk: when all records are already refunded, a legacy JSON payload would be refunded again", async () => {
    // Documents today's guard precisely: the normalized path filters on
    // refundedAt = null, so a fully refunded order with legacy JSON still on
    // the row re-enters the JSON fallback. Consolidation must keep migrated
    // rows' JSON cleared (or fix this) — this test pins the current behavior.
    const fakeTx = tx();
    fakeTx.serviceOrderAddonUsage.findMany.mockResolvedValue([]); // all rows already refunded

    await refundAddonUsages(fakeTx as never, "order-1", [{ entitlementId: "ent-legacy", credits: 4 }]);

    expect(fakeTx.memberEntitlement.updateMany).toHaveBeenCalledWith({
      where: { id: "ent-legacy" },
      data: { creditRemaining: { increment: 4 } },
    });
  });
});

describe("refundPrimaryCredit", () => {
  it("refunds the order's primary credit back to the entitlement", async () => {
    const fakeTx = tx();
    await refundPrimaryCredit(fakeTx as never, { memberEntitlementId: "ent-1", creditUsed: 3 });
    expect(fakeTx.memberEntitlement.updateMany).toHaveBeenCalledWith({
      where: { id: "ent-1" },
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
