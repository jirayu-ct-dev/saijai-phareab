import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  storefrontPrice: { findMany: vi.fn() },
  user: { findFirst: vi.fn() },
  serviceOrder: { findFirst: vi.fn(), updateMany: vi.fn() },
  serviceOrderItem: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  serviceOrderItemImage: { updateMany: vi.fn(), createMany: vi.fn() },
  paymentRecord: { update: vi.fn(), create: vi.fn() },
  paymentAuditLog: { create: vi.fn() },
  memberEntitlement: { findFirst: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
}));
const notifications = vi.hoisted(() => ({ notifyServiceOrderStatusChanged: vi.fn() }));
const numbers = vi.hoisted(() => ({ payment: vi.fn() }));
vi.mock("~~/server/utils/prisma", () => ({ prisma: db }));
vi.mock("~~/server/utils/auth", () => ({ requireRole: () => ({ id: "staff" }) }));
vi.mock("~~/server/utils/appSetting", () => ({ getBusinessSetting: async () => ({ hangerPricePerUnit: 0, washFoldPricePerKg: 0, vatRate: 0, vatIncluded: true }) }));
vi.mock("~~/server/utils/notify", () => notifications);
vi.mock("~~/server/utils/paymentNo", () => ({ createPaymentNo: numbers.payment }));
vi.mock("~~/server/utils/serviceOrderCredits", () => ({
  createAddonUsageRecords: vi.fn(),
  refundAddonUsages: vi.fn(),
  voidPendingAddonUsageRecords: vi.fn(),
}));

// The order was received 2026-09-01 (Bangkok 09:00); an edit must only accept
// packages whose validity window covers that original receive date.
let body: Record<string, unknown>;
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-05T05:00:00Z"));
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
  vi.stubGlobal("readBody", async () => body);
  vi.stubGlobal("getRouterParam", () => "order-1");
  vi.stubGlobal("createError", (input: unknown) => input);
  body = {
    customerId: "customer",
    memberEntitlementId: "entitlement",
    items: [{ storefrontPriceId: "price", quantity: 2 }],
    serviceOrderStatus: "RECEIVED",
  };
  db.$transaction.mockImplementation(async (operation) => operation(db));
  db.serviceOrder.findFirst.mockResolvedValue({
    id: "order-1",
    status: "RECEIVED",
    receivedAt: new Date("2026-09-01T02:00:00Z"),
    creditUsed: 0,
    memberEntitlementId: null,
    orderNo: "ORD-1",
    employeeId: "staff",
    completedAt: null,
    payments: [{ id: "payment", slipImage: null, slipImageId: null, userId: "customer", amount: 20, paidAt: null, metadata: {} }],
  });
  db.user.findFirst.mockResolvedValue({ id: "customer" });
  db.storefrontPrice.findMany.mockResolvedValue([{ id: "price", price: 20 }]);
  db.serviceOrder.updateMany.mockResolvedValue({ count: 1 });
  db.serviceOrderItem.findMany.mockResolvedValue([]);
  db.serviceOrderItem.create.mockResolvedValue({ id: "item" });
  db.paymentRecord.update.mockResolvedValue({});
  db.paymentAuditLog.create.mockResolvedValue({});
  db.memberEntitlement.findFirst.mockResolvedValue({ id: "entitlement", creditRemaining: 5 });
  db.memberEntitlement.updateMany.mockResolvedValue({ count: 1 });
  numbers.payment.mockResolvedValue("PAY-1");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const submit = async () => (await import("../../server/api/admin/service-orders/[id].put")).default({} as never);

describe("editing an order's monthly package", () => {
  it("accepts a covering package even when it has since expired and re-deducts with the window guard", async () => {
    await submit();
    expect(db.memberEntitlement.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        customerId: "customer",
        status: { in: ["ACTIVE", "EXPIRED"] },
        AND: expect.arrayContaining([
          { OR: [{ startAt: null }, { startAt: { lte: new Date("2026-09-01T02:00:00Z") } }] },
          { OR: [{ endAt: null }, { endAt: { gte: new Date("2026-09-01T02:00:00Z") } }] },
        ]),
      }),
    }));
    expect(db.memberEntitlement.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "entitlement", creditRemaining: { gte: 2 } }),
    }));
    expect(db.serviceOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ memberEntitlementId: "entitlement", creditUsed: 2 }),
    }));
  });

  it("rejects a package from another month with no writes", async () => {
    db.memberEntitlement.findFirst.mockResolvedValue(null);
    await expect(submit()).rejects.toMatchObject({ statusCode: 404 });
    expect(db.memberEntitlement.updateMany).not.toHaveBeenCalled();
    expect(db.serviceOrder.updateMany).not.toHaveBeenCalled();
    expect(db.paymentRecord.update).not.toHaveBeenCalled();
  });
});
