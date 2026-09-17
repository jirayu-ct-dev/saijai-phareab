import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeOrderCreditSnapshots, settleNegativeEntitlements } from "../../server/utils/serviceOrderCredits";

describe("settleNegativeEntitlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("settles a negative balance on an older entitlement using credits from a newly activated package", async () => {
    const mockTx = {
      memberEntitlement: {
        findFirst: vi.fn().mockResolvedValue({
          id: "new-ent-1",
          creditRemaining: 30,
        }),
        findMany: vi.fn().mockResolvedValue([
          { id: "old-ent-1", creditRemaining: -3 },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    await settleNegativeEntitlements(mockTx as never, "cust-1", "new-ent-1");

    // Old package is incremented by 3 to reach 0
    expect(mockTx.memberEntitlement.update).toHaveBeenCalledWith({
      where: { id: "old-ent-1" },
      data: { creditRemaining: { increment: 3 } },
    });

    // New package is updated to 27 (30 - 3)
    expect(mockTx.memberEntitlement.update).toHaveBeenCalledWith({
      where: { id: "new-ent-1" },
      data: { creditRemaining: 27 },
    });
  });

  it("settles across multiple negative packages in order until new package credits are exhausted", async () => {
    const mockTx = {
      memberEntitlement: {
        findFirst: vi.fn().mockResolvedValue({
          id: "new-ent-1",
          creditRemaining: 5,
        }),
        findMany: vi.fn().mockResolvedValue([
          { id: "old-ent-1", creditRemaining: -2 },
          { id: "old-ent-2", creditRemaining: -5 },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    await settleNegativeEntitlements(mockTx as never, "cust-1", "new-ent-1");

    // First old package is incremented by 2 (full 2 settled)
    expect(mockTx.memberEntitlement.update).toHaveBeenCalledWith({
      where: { id: "old-ent-1" },
      data: { creditRemaining: { increment: 2 } },
    });

    // Second old package is incremented by 3 (remaining 3 settled)
    expect(mockTx.memberEntitlement.update).toHaveBeenCalledWith({
      where: { id: "old-ent-2" },
      data: { creditRemaining: { increment: 3 } },
    });

    // New package is reduced from 5 to 0
    expect(mockTx.memberEntitlement.update).toHaveBeenCalledWith({
      where: { id: "new-ent-1" },
      data: { creditRemaining: 0 },
    });
  });

  it("does nothing when customer has no negative entitlements", async () => {
    const mockTx = {
      memberEntitlement: {
        findFirst: vi.fn().mockResolvedValue({
          id: "new-ent-1",
          creditRemaining: 30,
        }),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
      },
    };

    await settleNegativeEntitlements(mockTx as never, "cust-1", "new-ent-1");

    expect(mockTx.memberEntitlement.update).not.toHaveBeenCalled();
  });
});

describe("computeOrderCreditSnapshots", () => {
  it("marks ONLY the orders that actually overdraft the package balance as negative", async () => {
    // Entitlement with 10 credits initial, currently -3 in DB
    const mockDb = {
      memberEntitlement: {
        findMany: vi.fn().mockResolvedValue([
          { id: "ent-1", creditInitial: 10, creditRemaining: -3 },
        ]),
      },
      serviceOrder: {
        findMany: vi.fn().mockResolvedValue([
          { id: "ord-1", memberEntitlementId: "ent-1", creditUsed: 4, receivedAt: new Date("2026-09-01"), createdAt: new Date("2026-09-01") },
          { id: "ord-2", memberEntitlementId: "ent-1", creditUsed: 4, receivedAt: new Date("2026-09-05"), createdAt: new Date("2026-09-05") },
          { id: "ord-3", memberEntitlementId: "ent-1", creditUsed: 5, receivedAt: new Date("2026-09-10"), createdAt: new Date("2026-09-10") },
        ]),
      },
    };

    const snapshots = await computeOrderCreditSnapshots(
      [{ id: "ord-1", memberEntitlementId: "ent-1" }, { id: "ord-2", memberEntitlementId: "ent-1" }, { id: "ord-3", memberEntitlementId: "ent-1" }],
      mockDb as any
    );

    // Order 1 used 4 out of 10 -> remaining 6 -> NOT negative
    expect(snapshots.get("ord-1")).toEqual({
      orderCreditRemaining: 6,
      isOrderNegative: false,
      isSettled: false,
      orderCreditShortfall: 0,
    });

    // Order 2 used 4 out of 6 -> remaining 2 -> NOT negative
    expect(snapshots.get("ord-2")).toEqual({
      orderCreditRemaining: 2,
      isOrderNegative: false,
      isSettled: false,
      orderCreditShortfall: 0,
    });

    // Order 3 used 5 out of 2 -> remaining -3 -> IS negative (unsettled)
    expect(snapshots.get("ord-3")).toEqual({
      orderCreditRemaining: -3,
      isOrderNegative: true,
      isSettled: false,
      orderCreditShortfall: 3,
    });
  });

  it("marks overdraft orders as isSettled: true and isOrderNegative: false when debt has been settled by a new package", async () => {
    // Entitlement with 10 credits initial, 14 credits used, but debt was settled by new package so creditRemaining in DB is 0
    const mockDb = {
      memberEntitlement: {
        findMany: vi.fn().mockResolvedValue([
          { id: "ent-1", creditInitial: 10, creditRemaining: 0 },
        ]),
      },
      serviceOrder: {
        findMany: vi.fn().mockResolvedValue([
          { id: "ord-1", memberEntitlementId: "ent-1", creditUsed: 4, receivedAt: new Date("2026-09-01"), createdAt: new Date("2026-09-01") },
          { id: "ord-2", memberEntitlementId: "ent-1", creditUsed: 4, receivedAt: new Date("2026-09-05"), createdAt: new Date("2026-09-05") },
          { id: "ord-3", memberEntitlementId: "ent-1", creditUsed: 6, receivedAt: new Date("2026-09-10"), createdAt: new Date("2026-09-10") },
        ]),
      },
    };

    const snapshots = await computeOrderCreditSnapshots(
      [{ id: "ord-1", memberEntitlementId: "ent-1" }, { id: "ord-2", memberEntitlementId: "ent-1" }, { id: "ord-3", memberEntitlementId: "ent-1" }],
      mockDb as any
    );

    // Order 1 was within initial credit
    expect(snapshots.get("ord-1")).toEqual({
      orderCreditRemaining: 6,
      isOrderNegative: false,
      isSettled: false,
      orderCreditShortfall: 0,
    });

    // Order 2 was within initial credit
    expect(snapshots.get("ord-2")).toEqual({
      orderCreditRemaining: 2,
      isOrderNegative: false,
      isSettled: false,
      orderCreditShortfall: 0,
    });

    // Order 3 overdrafted by 4 credits, but all 4 credits were settled by new package
    expect(snapshots.get("ord-3")).toEqual({
      orderCreditRemaining: -4,
      isOrderNegative: false,
      isSettled: true,
      orderCreditShortfall: 4,
    });
  });

  it("handles multiple overdraft orders sequentially", async () => {
    const mockDb = {
      memberEntitlement: {
        findMany: vi.fn().mockResolvedValue([
          { id: "ent-1", creditInitial: 5, creditRemaining: -4 },
        ]),
      },
      serviceOrder: {
        findMany: vi.fn().mockResolvedValue([
          { id: "ord-1", memberEntitlementId: "ent-1", creditUsed: 3, receivedAt: new Date("2026-09-01"), createdAt: new Date("2026-09-01") },
          { id: "ord-2", memberEntitlementId: "ent-1", creditUsed: 4, receivedAt: new Date("2026-09-02"), createdAt: new Date("2026-09-02") },
          { id: "ord-3", memberEntitlementId: "ent-1", creditUsed: 2, receivedAt: new Date("2026-09-03"), createdAt: new Date("2026-09-03") },
        ]),
      },
    };

    const snapshots = await computeOrderCreditSnapshots(
      [{ id: "ord-1", memberEntitlementId: "ent-1" }, { id: "ord-2", memberEntitlementId: "ent-1" }, { id: "ord-3", memberEntitlementId: "ent-1" }],
      mockDb as any
    );

    expect(snapshots.get("ord-1")).toEqual({ orderCreditRemaining: 2, isOrderNegative: false, isSettled: false, orderCreditShortfall: 0 });
    expect(snapshots.get("ord-2")).toEqual({ orderCreditRemaining: -2, isOrderNegative: true, isSettled: false, orderCreditShortfall: 2 });
    expect(snapshots.get("ord-3")).toEqual({ orderCreditRemaining: -4, isOrderNegative: true, isSettled: false, orderCreditShortfall: 2 });
  });

  it("handles chained settlements across packages", async () => {
    // Ent-1 (L): initial 150, used 160 (150 + 10). Debt was 10.
    // When Ent-2 (S1, initial 50) was bought, Ent-1 got +10, so Ent-1 creditRemaining is 0.
    // Ent-2 paid 10 at start, so it had 40. It used 30 and 10 -> 0 remaining.
    // When Ent-3 (S2, initial 50) was bought, if Ent-2 also overdrafted...
    const mockDb = {
      memberEntitlement: {
        findMany: vi.fn().mockResolvedValue([
          { id: "ent-1", creditInitial: 150, creditRemaining: 0 },
          { id: "ent-2", creditInitial: 50, creditRemaining: 0 },
        ]),
      },
      serviceOrder: {
        findMany: vi.fn().mockResolvedValue([
          { id: "ord-1", memberEntitlementId: "ent-1", creditUsed: 150, receivedAt: new Date("2026-08-05"), createdAt: new Date("2026-08-05") },
          { id: "ord-2", memberEntitlementId: "ent-1", creditUsed: 10, receivedAt: new Date("2026-08-12"), createdAt: new Date("2026-08-12") },
          { id: "ord-3", memberEntitlementId: "ent-2", creditUsed: 30, receivedAt: new Date("2026-08-19"), createdAt: new Date("2026-08-19") },
          { id: "ord-4", memberEntitlementId: "ent-2", creditUsed: 10, receivedAt: new Date("2026-08-20"), createdAt: new Date("2026-08-20") },
        ]),
      },
    };

    const snapshots = await computeOrderCreditSnapshots(
      [
        { id: "ord-1", memberEntitlementId: "ent-1" },
        { id: "ord-2", memberEntitlementId: "ent-1" },
        { id: "ord-3", memberEntitlementId: "ent-2" },
        { id: "ord-4", memberEntitlementId: "ent-2" },
      ],
      mockDb as any
    );

    expect(snapshots.get("ord-2")).toEqual({
      orderCreditRemaining: -10,
      isOrderNegative: false,
      isSettled: true,
      orderCreditShortfall: 10,
    });
    expect(snapshots.get("ord-3")).toEqual({
      orderCreditRemaining: 10,
      isOrderNegative: false,
      isSettled: false,
      orderCreditShortfall: 0,
    });
    expect(snapshots.get("ord-4")).toEqual({
      orderCreditRemaining: 0,
      isOrderNegative: false,
      isSettled: false,
      orderCreditShortfall: 0,
    });
  });

  it("returns empty map when no orders or no entitlementId", async () => {
    const snapshots = await computeOrderCreditSnapshots([
      { id: "ord-no-ent", memberEntitlementId: null },
    ]);
    expect(snapshots.size).toBe(0);
  });
});
