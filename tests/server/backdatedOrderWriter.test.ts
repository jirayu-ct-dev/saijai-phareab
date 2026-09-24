import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  storefrontPrice: { findMany: vi.fn() },
  storefrontItem: { findMany: vi.fn() },
  user: { findFirst: vi.fn() },
  serviceOrder: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  serviceOrderItem: { create: vi.fn() },
  serviceOrderItemImage: { createMany: vi.fn() },
  paymentRecord: { create: vi.fn() },
  paymentAuditLog: { create: vi.fn() },
  memberEntitlement: { findFirst: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
}));
const notifications = vi.hoisted(() => ({ notifyQuotationCreated: vi.fn(), notifyReceipt: vi.fn(), notifyServiceOrderCreated: vi.fn(), notifyServiceOrderStatusChanged: vi.fn() }));
const numbers = vi.hoisted(() => ({ order: vi.fn(), quotation: vi.fn(), receipt: vi.fn() }));
vi.mock("~~/server/utils/prisma", () => ({ prisma: db }));
vi.mock("~~/server/utils/auth", () => ({ requireRole: () => ({ id: "staff" }) }));
vi.mock("~~/server/utils/appSetting", () => ({ getBusinessSetting: async () => ({ hangerPricePerUnit: 0, vatRate: 0, vatIncluded: true }) }));
vi.mock("~~/server/utils/notify", () => notifications);
vi.mock("~~/server/utils/serviceOrderNo", () => ({ createServiceOrderNo: numbers.order }));
vi.mock("~~/server/utils/quotationNo", () => ({ createQuotationNo: numbers.quotation }));
vi.mock("~~/server/utils/receiptNo", () => ({ createReceiptNo: numbers.receipt }));
vi.mock("~~/server/utils/paymentNo", () => ({ createPaymentNo: async () => "PAY-1" }));
vi.mock("~~/server/utils/customerAccount", () => ({ createOfflineCustomer: vi.fn(), isCustomerUniqueConflict: () => false, resolveOfflineCustomerConflict: async () => null }));
// The main-credit tests use no add-ons; add-on persistence has its own suite.
vi.mock("~~/server/utils/serviceOrderCredits", () => ({ createAddonUsageRecords: vi.fn() }));

let body: Record<string, unknown>;
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-05T05:00:00Z"));
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
  vi.stubGlobal("readBody", async () => body);
  vi.stubGlobal("createError", (input: unknown) => input);
  body = { customerId: "customer", items: [{ type: "STOREFRONT", storefrontPriceId: "price", quantity: 2 }], backdated: { receivedAt: "2026-09-01T09:00", status: "COMPLETED", completedAt: "2026-09-03T17:00", payment: { paidAt: "2026-09-02T10:00", method: "CASH" } } };
  db.$transaction.mockImplementation(async (operation) => operation(db));
  db.storefrontPrice.findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.includes("price") ? [{
    id: "price",
    price: 20,
    storefrontService: { id: "service", name: "ซักรีด" },
    storefrontItem: { id: "shirt", name: "เสื้อเชิ้ต" },
  }] : []);
  db.storefrontItem.findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.map((id) => ({ id, name: "เสื้อเชิ้ต" })));
  db.user.findFirst.mockResolvedValue({ id: "customer" });
  db.serviceOrder.create.mockImplementation(async ({ data }) => ({ ...data, id: "order" }));
  db.serviceOrderItem.create.mockResolvedValue({ id: "item" });
  db.paymentRecord.create.mockImplementation(async ({ data }) => ({ ...data, id: "payment" }));
  db.memberEntitlement.findFirst.mockResolvedValue({
    id: "entitlement",
    customerId: "customer",
    creditRemaining: 5,
    product: { packageServiceId: "package-service", packageService: { includedItems: [{ storefrontItemId: "shirt" }] } },
  });
  db.memberEntitlement.updateMany.mockResolvedValue({ count: 1 });
  numbers.order.mockResolvedValue("ORD-1");
  numbers.quotation.mockResolvedValue("QT-1");
  numbers.receipt.mockResolvedValue("RC-1");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const submit = async () => (await import("../../server/api/admin/service-orders/index.post")).default({} as never);

describe("recording a missed laundry order", () => {
  it("stores actual dates and paid amount atomically, numbers documents today and sends no stale alerts", async () => {
    await submit();
    expect(db.serviceOrder.create).toHaveBeenCalledWith({ data: expect.objectContaining({ receivedAt: new Date("2026-09-01T02:00Z"), completedAt: new Date("2026-09-03T10:00Z"), status: "COMPLETED" }) });
    expect(db.serviceOrder.create.mock.calls[0]![0].data.createdAt).toBeUndefined();
    expect(db.paymentRecord.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amount: 40, status: "PAID", method: "CASH", paidAt: new Date("2026-09-02T03:00Z"), confirmedAt: new Date("2026-09-05T05:00Z"), confirmedById: "staff", receiptNo: "RC-1" }) });
    expect(numbers.order).toHaveBeenCalledWith(new Date("2026-09-05T05:00Z"));
    expect(numbers.receipt).toHaveBeenCalledWith(new Date("2026-09-05T05:00Z"), db);
    expect(db.paymentAuditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorId: "staff", afterJson: expect.objectContaining({ backdated: true }) }) });
    expect(notifications.notifyServiceOrderCreated).not.toHaveBeenCalled();
    expect(notifications.notifyQuotationCreated).not.toHaveBeenCalled();
    expect(notifications.notifyServiceOrderStatusChanged).not.toHaveBeenCalled();
    expect(db.serviceOrder.update).not.toHaveBeenCalled();
  });

  it("leaves an unpaid historical intake RECEIVED without auto-progressing", async () => {
    body.backdated = { receivedAt: "2026-09-01T09:00", status: "RECEIVED" };
    await submit();
    expect(db.paymentRecord.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "UNPAID", paidAt: null, confirmedAt: null, receiptNo: null }) });
    expect(db.serviceOrder.update).not.toHaveBeenCalled();
  });

  it("retains the existing notification and progression flow for normal intake", async () => {
    delete body.backdated;
    await submit();
    expect(notifications.notifyServiceOrderCreated).toHaveBeenCalled();
    expect(db.serviceOrder.updateMany).toHaveBeenCalledWith({ where: { id: "order", status: "RECEIVED", deletedAt: null }, data: { status: "PROCESSING" } });
  });

  it("rejects invalid dates before any writes", async () => {
    body.backdated = { receivedAt: "2026-09-06T09:00", status: "RECEIVED" };
    await expect(submit()).rejects.toMatchObject({ statusCode: 400 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("deducts historical package usage from the current balance with validity and race guards", async () => {
    body.memberEntitlementId = "entitlement";
    body.items = [{ type: "PACKAGE", storefrontItemId: "shirt", quantity: 2 }];
    body.backdated = { receivedAt: "2026-09-01T09:00", status: "RECEIVED" };
    await submit();
    expect(db.memberEntitlement.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ customerId: "customer", status: { in: ["ACTIVE", "EXPIRED"] }, AND: expect.arrayContaining([{ OR: [{ endAt: null }, { endAt: { gte: new Date("2026-09-01T02:00Z") } }] }]) }) }));
    expect(db.memberEntitlement.updateMany).toHaveBeenCalledWith({ where: expect.objectContaining({ id: "entitlement" }), data: { creditRemaining: { decrement: 2 } } });
    expect(db.paymentRecord.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amount: 0, status: "PAID", paidAt: new Date("2026-09-01T02:00Z") }) });
  });

  it("closes a zero-total package order and sends a receipt notification", async () => {
    delete body.backdated;
    body.memberEntitlementId = "entitlement";
    body.items = [{ type: "PACKAGE", storefrontItemId: "shirt", quantity: 2 }];

    await submit();

    expect(db.paymentRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ amount: 0, status: "PAID", receiptNo: "RC-1", confirmedById: "staff" }),
    });
    expect(notifications.notifyReceipt).toHaveBeenCalledWith({ paymentId: "payment" });
  });

  it("stops when another order consumes the credits before commit", async () => {
    body.memberEntitlementId = "entitlement";
    body.items = [{ type: "PACKAGE", storefrontItemId: "shirt", quantity: 2 }];
    db.memberEntitlement.updateMany.mockResolvedValue({ count: 0 });
    await expect(submit()).rejects.toMatchObject({ statusCode: 409 });
    expect(db.serviceOrder.create).not.toHaveBeenCalled();
    expect(db.paymentRecord.create).not.toHaveBeenCalled();
  });

  it("rejects clothing that is not included in the package service", async () => {
    body.memberEntitlementId = "entitlement";
    body.items = [{ type: "PACKAGE", storefrontItemId: "shirt", quantity: 2 }];
    db.memberEntitlement.findFirst.mockResolvedValue({
      id: "entitlement",
      customerId: "customer",
      creditRemaining: 5,
      product: { packageServiceId: "package-service", packageService: { includedItems: [{ storefrontItemId: "pants" }] } },
    });

    await expect(submit()).rejects.toMatchObject({ statusCode: 400 });
    expect(db.memberEntitlement.updateMany).not.toHaveBeenCalled();
    expect(db.serviceOrder.create).not.toHaveBeenCalled();
  });

  it("rejects a package whose validity window does not cover the recorded receive date", async () => {
    body.memberEntitlementId = "entitlement";
    db.memberEntitlement.findFirst.mockResolvedValue(null);
    await expect(submit()).rejects.toMatchObject({ statusCode: 404 });
    expect(db.memberEntitlement.updateMany).not.toHaveBeenCalled();
    expect(db.serviceOrder.create).not.toHaveBeenCalled();
    expect(db.paymentRecord.create).not.toHaveBeenCalled();
  });
});
