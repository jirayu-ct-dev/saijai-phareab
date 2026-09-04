import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({ $transaction: vi.fn() }));
vi.mock("~~/server/utils/prisma", () => ({ prisma: prismaMock }));

const decimal = (value: string) => ({ toFixed: () => value });
const payment = {
  id: "payment-1",
  paymentNo: "PAY-1",
  receiptNo: "RC-1",
  amount: decimal("125.00"),
  status: "UNPAID",
  note: null,
  updatedAt: new Date("2026-09-03T00:00:00.000Z"),
  user: { name: "ลูกค้าทดสอบ", phoneNumber: null },
  serviceOrder: {
    id: "order-1",
    orderNo: "ORD-1",
    quotationNo: "QT-1",
    subtotalAmount: decimal("125.00"),
    discountAmount: decimal("0.00"),
    note: null,
    weightKg: null,
    serviceOrderItems: [{
      quantity: 1,
      unitPrice: decimal("125.00"),
      totalPrice: decimal("125.00"),
      notes: null,
      isPackageIncluded: false,
      storefrontPrice: {
        storefrontService: { name: "ซัก" },
        storefrontItem: { name: "เสื้อ" },
      },
    }],
  },
  packageSale: null,
};

const setting = {
  name: "ร้านไสใจ",
  phone: "0800000000",
  address: "แพร่",
  lineQrImageUrl: "https://res.cloudinary.com/demo/image/upload/line.png",
  lineQrEnabled: false,
  paymentQrEnabled: false,
  paymentQrProvider: null,
  paymentQrReceiverType: null,
  paymentQrReceiverCiphertext: null,
  paymentQrReceiverLast4: null,
  paymentQrReceiverLabel: null,
  paymentQrKeyVersion: null,
  paymentQrConfigVersion: 0,
  paymentQrActivatedAt: null,
};

beforeEach(() => vi.clearAllMocks());

describe("current direct print document read", () => {
  it("reads payment and settings in one transaction without Printer/PrintJob access", async () => {
    const tx = {
      paymentRecord: { findFirst: vi.fn().mockResolvedValue(payment) },
      appSetting: { findUnique: vi.fn().mockResolvedValue(setting) },
    };
    prismaMock.$transaction.mockImplementation(async (work: (value: typeof tx) => unknown) => work(tx));
    const { loadDirectPrintDocument } = await import("../../server/utils/directPrintDocument");

    const document = await loadDirectPrintDocument(prismaMock as never, {
      paymentId: "payment-1",
      kind: "QUOTATION",
      now: new Date("2026-09-03T01:00:00.000Z"),
    });

    expect(tx.paymentRecord.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "payment-1", deletedAt: null },
    }));
    const paymentQuery = tx.paymentRecord.findFirst.mock.calls[0]?.[0];
    expect(paymentQuery.include.serviceOrder.select).toMatchObject({
      orderNo: true,
      receivedAt: true,
      completedAt: true,
      dueAt: true,
      washFoldPricePerKgSnapshot: true,
      hangerCharge: true,
      employee: { select: { name: true } },
    });
    expect(paymentQuery.include.serviceOrder.select.addonUsageRecords.where)
      .toEqual({ refundedAt: null });
    expect(paymentQuery.include.packageSale.select).toMatchObject({
      note: true,
      soldBy: { select: { name: true } },
    });
    expect(tx.appSetting.findUnique).toHaveBeenCalledWith({ where: { id: "singleton" } });
    expect(document.documentNo).toBe("QT-1");
    expect(document.shop.logoUrl).toBe("/logo-saijai-phareab.png");
    expect(document.totals.totalAmountMinor).toBe(12_500);
    expect(document.qrBlocks).toEqual([]);
    expect("printer" in tx).toBe(false);
    expect("printJob" in tx).toBe(false);
  });

  it("constrains customer quotation reads by the authenticated owner", async () => {
    const tx = {
      paymentRecord: { findFirst: vi.fn().mockResolvedValue(payment) },
      appSetting: { findUnique: vi.fn().mockResolvedValue(setting) },
    };
    prismaMock.$transaction.mockImplementation(async (work: (value: typeof tx) => unknown) => work(tx));
    const { loadDirectPrintDocument } = await import("../../server/utils/directPrintDocument");

    await loadDirectPrintDocument(prismaMock as never, {
      paymentId: "payment-1",
      kind: "QUOTATION",
      userId: "user-1",
    });

    expect(tx.paymentRecord.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "payment-1", deletedAt: null, userId: "user-1" },
    }));
  });
});
