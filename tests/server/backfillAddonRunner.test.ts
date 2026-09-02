/**
 * DB-05 add-on backfill runner: order-level fail-closed behavior.
 *
 * An order whose legacy JSON contains at least one parseable entry
 * referencing a missing entitlement must be quarantined WHOLE — no ledger
 * row may be created for any pair of that order. A partial migration would
 * break the credits_json_vs_ledger parity that the reconciliation check
 * still counts from the raw JSON. Clean orders in the same batch are still
 * migrated (fail-closed is per service order, not per batch).
 *
 * The transaction client is an in-memory fake mirroring only the operations
 * the runner consumes.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAddonJsonToLedger } from "../../scripts/db-rehearsal/backfill/backfill.mts";

type RunnerDb = Parameters<typeof runAddonJsonToLedger>[0];

const makeDb = ({
  orders,
  entitlementIds,
  ledgerRows = [],
}: {
  orders: Array<{ id: string; addonUsages: unknown }>;
  entitlementIds: string[];
  ledgerRows?: Array<{ serviceOrderId: string; memberEntitlementId: string; credits: number }>;
}) => ({
  serviceOrder: {
    findMany: vi.fn().mockResolvedValue(orders),
  },
  memberEntitlement: {
    // Current per-entry lookup (findUnique) and the bulk existence check
    // (findMany) both served, so the fake works before and after the fix.
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      entitlementIds.includes(where.id) ? { id: where.id } : null),
    findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.filter((id: string) => entitlementIds.includes(id)).map((id: string) => ({ id }))),
  },
  serviceOrderAddonUsage: {
    findMany: vi.fn(async ({ where }: { where: { serviceOrderId: string; memberEntitlementId: string } }) =>
      ledgerRows.filter(
        (row) => row.serviceOrderId === where.serviceOrderId && row.memberEntitlementId === where.memberEntitlementId,
      )),
    createMany: vi.fn().mockResolvedValue({ count: 2 }),
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runAddonJsonToLedger (order-level fail closed)", () => {
  it("creates no ledger rows for an order with a parseable entry referencing a missing entitlement", async () => {
    const db = makeDb({
      orders: [
        {
          id: "order-mixed",
          addonUsages: [
            { entitlementId: "fxent1", credits: 1, deductOn: "CREATED", deductedAt: "2026-08-16T09:00:00.000Z" },
            { entitlementId: "fxent_ghost", credits: 2, deductOn: "CREATED", deductedAt: "2026-08-16T09:05:00.000Z" },
          ],
        },
      ],
      entitlementIds: ["fxent1"],
    });

    const report = await runAddonJsonToLedger(db as unknown as RunnerDb, "apply");

    expect(report.quarantine).toEqual([
      {
        subjectId: "order-mixed",
        subjectPart: "entry:1",
        reason: "missing-entitlement",
        detail: "referenced entitlement does not exist",
        disposition: "pending",
      },
    ]);
    expect(db.serviceOrderAddonUsage.createMany).not.toHaveBeenCalled();
    expect(report.rowsChanged).toBe(0);
  });

  it("still migrates a clean order in the same batch (fail closed is per order)", async () => {
    const db = makeDb({
      orders: [
        {
          id: "order-mixed",
          addonUsages: [
            { entitlementId: "fxent1", credits: 1, deductOn: "CREATED", deductedAt: "2026-08-16T09:00:00.000Z" },
            { entitlementId: "fxent_ghost", credits: 2, deductOn: "CREATED", deductedAt: "2026-08-16T09:05:00.000Z" },
          ],
        },
        {
          id: "order-clean",
          addonUsages: [
            { entitlementId: "fxent1", credits: 3, deductOn: "CREATED", deductedAt: "2026-08-16T10:00:00.000Z" },
          ],
        },
      ],
      entitlementIds: ["fxent1"],
    });

    const report = await runAddonJsonToLedger(db as unknown as RunnerDb, "apply");

    expect(report.quarantine.every((entry) => entry.subjectId !== "order-clean")).toBe(true);
    expect(db.serviceOrderAddonUsage.createMany).toHaveBeenCalledTimes(1);
    expect(db.serviceOrderAddonUsage.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ serviceOrderId: "order-clean", memberEntitlementId: "fxent1", credits: 3 }),
      ],
    });
    expect(report.rowsChanged).toBe(1);
  });

  it("stays idempotent: an order whose ledger already matches the JSON writes nothing", async () => {
    const db = makeDb({
      orders: [
        {
          id: "order-done",
          addonUsages: [
            { entitlementId: "fxent1", credits: 2, deductOn: "CREATED", deductedAt: "2026-08-16T09:00:00.000Z" },
          ],
        },
      ],
      entitlementIds: ["fxent1"],
      ledgerRows: [{ serviceOrderId: "order-done", memberEntitlementId: "fxent1", credits: 2 }],
    });

    const report = await runAddonJsonToLedger(db as unknown as RunnerDb, "apply");

    expect(db.serviceOrderAddonUsage.createMany).not.toHaveBeenCalled();
    expect(report.rowsChanged).toBe(0);
    expect(report.quarantine).toEqual([]);
    expect(report.mismatches).toEqual([]);
  });
});
