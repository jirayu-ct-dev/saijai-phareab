import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { findMany: vi.fn() },
}));

vi.mock("~~/server/utils/prisma", () => ({ prisma: db }));
vi.mock("~~/server/utils/auth", () => ({ requireRole: () => ({ id: "staff" }) }));

let query: Record<string, unknown>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
  vi.stubGlobal("getValidatedQuery", async (_event: unknown, parser: (q: unknown) => unknown) => parser(query));
  vi.stubGlobal("createError", (input: unknown) => input);
  query = {};
  db.user.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const submit = async () => (await import("../../server/api/admin/customer-options.get")).default({} as never);

describe("POS customer-options endpoint", () => {
  it("queries only ACTIVE member entitlements when receivedAt is provided (backdated order)", async () => {
    query = { receivedAt: "2026-09-01T09:00" };
    await submit();

    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          memberEntitlements: expect.objectContaining({
            where: expect.objectContaining({
              deletedAt: null,
              status: "ACTIVE",
            }),
          }),
        }),
      }),
    );
  });

  it("queries only ACTIVE member entitlements when receivedAt is omitted (current order)", async () => {
    query = {};
    await submit();

    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          memberEntitlements: expect.objectContaining({
            where: expect.objectContaining({
              deletedAt: null,
              status: "ACTIVE",
            }),
          }),
        }),
      }),
    );
  });

  it("prioritizes MAIN entitlements with remaining credits and sorts by earliest expiry", async () => {
    db.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        name: "Test Customer",
        email: "cust@example.com",
        phoneNumber: "0812345678",
        image: null,
        customerAccountStatus: "VERIFIED",
        memberEntitlements: [
          {
            id: "ent-empty",
            creditInitial: 50,
            creditRemaining: 0,
            startAt: new Date("2026-08-01"),
            endAt: new Date("2026-08-31"),
            product: { id: "prod-1", name: "Old Package", packageType: "MAIN", packageServiceId: "pkgsvc-1", packageService: { name: "Wash", includedItems: [{ storefrontItemId: "shirt", storefrontItem: { id: "shirt", name: "เสื้อ" } }] } },
          },
          {
            id: "ent-with-credit",
            creditInitial: 100,
            creditRemaining: 40,
            startAt: new Date("2026-09-01"),
            endAt: new Date("2026-09-30"),
            product: { id: "prod-2", name: "New Package", packageType: "MAIN", packageServiceId: "pkgsvc-1", packageService: { name: "Wash", includedItems: [{ storefrontItemId: "shirt", storefrontItem: { id: "shirt", name: "เสื้อ" } }] } },
          },
        ],
      },
    ]);

    const result = await submit();
    expect(result[0].activeMemberEntitlement?.id).toBe("ent-with-credit");
    expect(result[0].memberEntitlementOptions[0].id).toBe("ent-with-credit");
    expect(result[0].memberEntitlementOptions[1].id).toBe("ent-empty");
  });
});
