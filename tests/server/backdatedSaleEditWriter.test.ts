import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  packageProduct: { findMany: vi.fn() },
  user: { findFirst: vi.fn() },
  packageSale: { findFirst: vi.fn(), update: vi.fn() },
  packageSaleItem: { count: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
  memberEntitlement: { updateMany: vi.fn(), create: vi.fn() },
  paymentRecord: { update: vi.fn(), create: vi.fn() },
  paymentAuditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("~~/server/utils/prisma", () => ({ prisma: db }));
vi.mock("~~/server/utils/auth", () => ({ requireRole: () => ({ id: "staff" }) }));
vi.mock("~~/server/utils/appSetting", () => ({ getBusinessSetting: async () => ({ vatRate: 0, vatIncluded: true }) }));
vi.mock("~~/server/utils/paymentNo", () => ({ createPaymentNo: async () => "PAY-1" }));

let body: Record<string, unknown>;
let existingSale: Record<string, unknown>;
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-05T05:00:00Z"));
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
  vi.stubGlobal("readBody", async () => body);
  vi.stubGlobal("getRouterParam", () => "sale-1");
  vi.stubGlobal("createError", (input: unknown) => input);
  body = { customerId: "customer", items: [{ productId: "pkg", quantity: 1 }], discountAmount: 0 };
  db.$transaction.mockImplementation(async (operation) => operation(db));
  db.packageSale.findFirst.mockImplementation(async () => existingSale);
  db.user.findFirst.mockResolvedValue({ id: "customer" });
  db.packageProduct.findMany.mockResolvedValue([{ id: "pkg", price: 100, credits: 10, validityDays: 30, packageType: "MAIN" }]);
  db.packageSaleItem.count.mockResolvedValue(0);
  db.packageSaleItem.deleteMany.mockResolvedValue({ count: 1 });
  db.packageSaleItem.create.mockImplementation(async ({ data }) => ({ ...data, id: "sale-item" }));
  db.memberEntitlement.updateMany.mockResolvedValue({ count: 1 });
  db.memberEntitlement.create.mockResolvedValue({ id: "entitlement" });
  db.packageSale.update.mockResolvedValue({});
  db.paymentRecord.update.mockResolvedValue({});
  db.paymentAuditLog.create.mockResolvedValue({});
  existingSale = {
    id: "sale-1",
    customerId: "customer",
    createdAt: new Date("2026-09-01T02:00:00Z"),
    items: [{ id: "item-1", memberEntitlements: [] }],
    payments: [{ id: "payment-1", status: "UNPAID", metadata: { backdated: { soldAt: "2026-09-01T02:00:00.000Z" }, createdByAdminId: "staff" } }],
  };
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const submit = async () => (await import("../../server/api/admin/package-sales/[id].put")).default({} as never);

describe("editing a package sale", () => {
  it("keeps an unpaid sale's entitlements pending and preserves paidAt and the backdated marker", async () => {
    await submit();
    expect(db.memberEntitlement.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      status: "PENDING",
      startAt: null,
      endAt: null,
      activatedAt: null,
    }) });
    expect(db.paymentRecord.update).toHaveBeenCalledWith({ where: { id: "payment-1" }, data: expect.objectContaining({
      metadata: expect.objectContaining({ backdated: { soldAt: "2026-09-01T02:00:00.000Z" }, createdByAdminId: "staff" }),
    }) });
    const updateData = db.paymentRecord.update.mock.calls[0][0].data;
    expect(updateData.paidAt).toBeUndefined();
    expect(db.paymentAuditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ paymentId: "payment-1", action: "UPDATED" }) });
  });

  it("re-anchors a paid sale's entitlement window at the original sale date", async () => {
    existingSale = {
      ...existingSale,
      payments: [{ id: "payment-1", status: "PAID", metadata: {} }],
    };
    await submit();
    expect(db.memberEntitlement.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      status: "ACTIVE",
      startAt: new Date("2026-09-01T02:00:00Z"),
      activatedAt: new Date("2026-09-01T02:00:00Z"),
      endAt: new Date("2026-10-01T02:00:00Z"),
    }) });
  });

  it("rejects the edit inside the transaction once a credit has been consumed", async () => {
    db.packageSaleItem.count.mockResolvedValue(1);
    await expect(submit()).rejects.toMatchObject({ statusCode: 409 });
    expect(db.memberEntitlement.updateMany).not.toHaveBeenCalled();
    expect(db.packageSale.update).not.toHaveBeenCalled();
  });
});
