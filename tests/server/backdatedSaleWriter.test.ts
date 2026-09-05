import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  packageProduct: { findMany: vi.fn() },
  user: { findFirst: vi.fn() },
  packageSale: { create: vi.fn() },
  packageSaleItem: { create: vi.fn() },
  memberEntitlement: { create: vi.fn() },
  paymentRecord: { create: vi.fn() },
  paymentAuditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));
const notifications = vi.hoisted(() => ({ notifyReceipt: vi.fn() }));
const numbers = vi.hoisted(() => ({ receipt: vi.fn() }));
const customerAccount = vi.hoisted(() => ({
  createOfflineCustomer: vi.fn(),
  isCustomerUniqueConflict: vi.fn(() => false),
  resolveOfflineCustomerConflict: vi.fn(async () => null),
}));
vi.mock("~~/server/utils/prisma", () => ({ prisma: db }));
vi.mock("~~/server/utils/auth", () => ({ requireRole: () => ({ id: "staff" }) }));
vi.mock("~~/server/utils/appSetting", () => ({ getBusinessSetting: async () => ({ vatRate: 0, vatIncluded: true }) }));
vi.mock("~~/server/utils/notify", () => notifications);
vi.mock("~~/server/utils/receiptNo", () => ({ createReceiptNo: numbers.receipt }));
vi.mock("~~/server/utils/paymentNo", () => ({ createPaymentNo: async () => "PAY-1" }));
vi.mock("~~/server/utils/customerAccount", () => customerAccount);

let body: Record<string, unknown>;
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-05T05:00:00Z"));
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
  vi.stubGlobal("readBody", async () => body);
  vi.stubGlobal("createError", (input: unknown) => input);
  body = {
    customerId: "customer",
    items: [{ productId: "pkg", quantity: 1 }],
    backdated: { soldAt: "2026-09-01T09:00", payment: { paidAt: "2026-09-01T10:00", method: "CASH" } },
  };
  db.$transaction.mockImplementation(async (operation) => operation(db));
  db.packageProduct.findMany.mockResolvedValue([{ id: "pkg", price: 100, credits: 10, validityDays: 30, packageType: "MAIN" }]);
  db.user.findFirst.mockResolvedValue({ id: "customer" });
  db.packageSale.create.mockImplementation(async ({ data }) => ({ ...data, id: "sale" }));
  db.packageSaleItem.create.mockImplementation(async ({ data }) => ({ ...data, id: "sale-item" }));
  db.memberEntitlement.create.mockResolvedValue({ id: "entitlement" });
  db.paymentRecord.create.mockImplementation(async ({ data }) => ({ ...data, id: "payment" }));
  numbers.receipt.mockResolvedValue("RC-1");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const submit = async () => (await import("../../server/api/admin/package-sales/index.post")).default({} as never);

describe("recording a missed package sale", () => {
  it("stores actual sale and payment dates, starts entitlement in the past, numbers documents today and sends no stale alerts", async () => {
    await submit();
    expect(db.packageSale.create).toHaveBeenCalledWith({ data: expect.objectContaining({ createdAt: new Date("2026-09-01T02:00Z") }) });
    expect(db.memberEntitlement.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      status: "ACTIVE",
      startAt: new Date("2026-09-01T02:00Z"),
      activatedAt: new Date("2026-09-01T02:00Z"),
      endAt: new Date("2026-10-01T02:00Z"),
    }) });
    expect(db.paymentRecord.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      status: "PAID",
      method: "CASH",
      paidAt: new Date("2026-09-01T03:00Z"),
      confirmedAt: new Date("2026-09-05T05:00Z"),
      receiptNo: "RC-1",
    }) });
    expect(numbers.receipt).toHaveBeenCalledWith(new Date("2026-09-05T05:00Z"), db);
    expect(db.paymentAuditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ afterJson: expect.objectContaining({ backdated: true }) }) });
    expect(notifications.notifyReceipt).not.toHaveBeenCalled();
  });

  it("keeps unpaid backdated sales pending without receipt or activation", async () => {
    body = { customerId: "customer", items: [{ productId: "pkg", quantity: 1 }], backdated: { soldAt: "2026-09-01T09:00" } };
    await submit();
    expect(db.paymentRecord.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "UNPAID", method: null, paidAt: null, receiptNo: null }) });
    expect(db.memberEntitlement.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "PENDING", startAt: null, endAt: null, activatedAt: null }) });
    expect(numbers.receipt).not.toHaveBeenCalled();
  });

  it("rejects a future sale date", async () => {
    body = { customerId: "customer", items: [{ productId: "pkg", quantity: 1 }], backdated: { soldAt: "2026-09-06T12:00" } };
    await expect(submit()).rejects.toMatchObject({ statusCode: 400 });
    expect(db.packageSale.create).not.toHaveBeenCalled();
  });

  it("creates a new offline customer and returns the activation token", async () => {
    body = {
      newCustomer: { name: "คุณใหม่", phoneNumber: "0812345678", email: null },
      items: [{ productId: "pkg", quantity: 1 }],
      backdated: { soldAt: "2026-09-01T09:00" },
    };
    customerAccount.createOfflineCustomer.mockResolvedValue({ customer: { id: "new-customer" }, activationToken: "token-1" });
    const result = await submit();
    expect(customerAccount.createOfflineCustomer).toHaveBeenCalledWith(db, expect.objectContaining({
      name: "คุณใหม่",
      phoneNumber: "0812345678",
      createdByStaffId: "staff",
    }));
    expect(result.activationToken).toBe("token-1");
    expect(db.packageSale.create).toHaveBeenCalledWith({ data: expect.objectContaining({ customerId: "new-customer" }) });
    expect(db.memberEntitlement.create).toHaveBeenCalledWith({ data: expect.objectContaining({ customerId: "new-customer", status: "PENDING" }) });
  });

  it("rejects a new customer without a phone number", async () => {
    body = { newCustomer: { name: "คุณใหม่" }, items: [{ productId: "pkg", quantity: 1 }] };
    await expect(submit()).rejects.toMatchObject({ statusCode: 400 });
    expect(customerAccount.createOfflineCustomer).not.toHaveBeenCalled();
    expect(db.packageSale.create).not.toHaveBeenCalled();
  });
});
