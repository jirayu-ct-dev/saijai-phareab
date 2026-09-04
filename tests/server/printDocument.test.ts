import { describe, expect, it } from "vitest";
import {
  buildPaymentQrSettingSnapshot,
  buildPrintDocument,
  canonicalJsonStringify,
  decimalToMinorExact,
  decryptPaymentQrReceiverValue,
  encryptPaymentQrReceiverValue,
  snapshotHashOf,
} from "../../server/utils/printDocument";
import type { PrintPaymentSource } from "../../server/utils/printDocument";
import { buildPromptPayPayload } from "../../server/utils/paymentQr/encoder";
import type { PrintDocument } from "../../shared/types/printing";

const APP_SETTING = {
  name: "ร้านไทยพรีเมียร์ ซักรีด",
  phone: "02-123-4567",
  address: "1 ถนนตัวอย่าง กรุงเทพฯ",
  lineQrImageUrl: "https://example.com/line-qr.png",
  paymentQrEnabled: true,
  paymentQrProvider: "PROMPTPAY_LOCAL",
  paymentQrReceiverType: "MOBILE",
  paymentQrReceiverCiphertext: "v1.cipher",
  paymentQrReceiverLast4: "5678",
  paymentQrReceiverLabel: "ร้านไทยพรีเมียร์",
  paymentQrKeyVersion: 1,
  paymentQrConfigVersion: 3,
  paymentQrActivatedAt: new Date("2026-01-01T00:00:00Z"),
  lineQrEnabled: true,
};

const decimal = (value: string) => ({ toFixed: (digits: number) => Number(value).toFixed(digits) });

const makePayment = (overrides: Partial<PrintPaymentSource> = {}): PrintPaymentSource => ({
  id: "payment-1",
  paymentNo: "PAY-0001",
  receiptNo: null,
  amount: decimal("1234.56"),
  status: "UNPAID",
  note: null,
  updatedAt: new Date("2026-06-01T03:00:00.000Z"),
  user: { name: "ลูกค้า ตัวอย่าง", phoneNumber: "0812345678" },
  serviceOrder: {
    id: "order-1",
    orderNo: "ORD-0001",
    quotationNo: "QT-0001",
    subtotalAmount: decimal("1234.56"),
    discountAmount: decimal("0"),
    note: null,
    weightKg: null,
    serviceOrderItems: [
      {
        quantity: 2,
        unitPrice: decimal("600"),
        totalPrice: decimal("1200"),
        notes: null,
        isPackageIncluded: false,
        storefrontPrice: {
          storefrontService: { name: "ซัก" },
          storefrontItem: { name: "เสื้อ" },
        },
      },
      {
        quantity: 1,
        unitPrice: decimal("34.56"),
        totalPrice: decimal("34.56"),
        notes: null,
        isPackageIncluded: false,
        storefrontPrice: {
          storefrontService: { name: "รีด" },
          storefrontItem: { name: "กางเกง" },
        },
      },
    ],
  },
  packageSale: null,
  ...overrides,
});

describe("exact money conversion (C10)", () => {
  it("converts decimal strings to exact minor units via string math", () => {
    expect(decimalToMinorExact("1234.56")).toBe(123456);
    expect(decimalToMinorExact("0.05")).toBe(5);
    expect(decimalToMinorExact("0")).toBe(0);
    expect(decimalToMinorExact("60")).toBe(6000);
  });

  it("converts Prisma-Decimal-like values through toFixed(2)", () => {
    expect(decimalToMinorExact({ toFixed: () => "1234.56" })).toBe(123456);
    expect(decimalToMinorExact({ toFixed: () => "0.10" })).toBe(10);
  });

  it("rejects more than two decimal places and non-numeric input", () => {
    expect(() => decimalToMinorExact("1.234")).toThrow();
    expect(() => decimalToMinorExact("abc")).toThrow();
  });
});

describe("snapshot hashing (C12)", () => {
  it("canonical JSON is key-order independent and stable", () => {
    const a = { b: 1, a: { y: 2, x: 3 } };
    const b = { a: { x: 3, y: 2 }, b: 1 };
    expect(canonicalJsonStringify(a)).toBe(canonicalJsonStringify(b));
  });

  it("snapshotHashOf is deterministic for the same document", () => {
    const built = buildPrintDocument({
      kind: "QUOTATION",
      payment: makePayment(),
      setting: APP_SETTING,
      receiverValue: "0812345678",
      now: new Date("2026-06-01T03:00:00.000Z"),
    });
    const second = buildPrintDocument({
      kind: "QUOTATION",
      payment: makePayment(),
      setting: APP_SETTING,
      receiverValue: "0812345678",
      now: new Date("2026-06-01T03:00:00.000Z"),
    });
    expect(snapshotHashOf(built.document)).toBe(snapshotHashOf(second.document));
  });
});

describe("payment QR receiver encryption", () => {
  it("round-trips encrypt/decrypt with a keyring", () => {
    const key = Buffer.alloc(32, 7);
    const ciphertext = encryptPaymentQrReceiverValue({
      value: "0812345678",
      keyVersion: 1,
      key,
    });
    const resolved = decryptPaymentQrReceiverValue({
      ciphertext,
      keyVersion: 1,
      keyring: { "1": key },
    });
    expect(resolved).toEqual({ ok: true, value: "0812345678" });
  });

  it("fails closed on a missing key or tampered ciphertext", () => {
    const key = Buffer.alloc(32, 7);
    const ciphertext = encryptPaymentQrReceiverValue({ value: "0812345678", keyVersion: 1, key });
    expect(
      decryptPaymentQrReceiverValue({ ciphertext, keyVersion: 2, keyring: { "1": key } }),
    ).toMatchObject({ ok: false });
    expect(
      decryptPaymentQrReceiverValue({
        ciphertext: "v1.aaaa.bbbb.cccc",
        keyVersion: 1,
        keyring: { "1": key },
      }),
    ).toMatchObject({ ok: false });
    expect(decryptPaymentQrReceiverValue({ ciphertext, keyVersion: 1, keyring: {} })).toMatchObject({
      ok: false,
    });
  });
});

describe("payment QR eligibility matrix (C9 display policy)", () => {
  const build = (overrides: {
    kind?: "RECEIPT" | "QUOTATION";
    payment?: Partial<PrintPaymentSource>;
    setting?: Partial<typeof APP_SETTING>;
  }) =>
    buildPrintDocument({
      kind: overrides.kind ?? "QUOTATION",
      payment: makePayment(overrides.payment ?? {}),
      setting: { ...APP_SETTING, ...overrides.setting },
      receiverValue: "0812345678",
      now: new Date("2026-06-01T03:00:00.000Z"),
    });

  it("UNPAID quotation + enabled + activated receiver -> PAYMENT block with exact amount", () => {
    const built = build({});
    const paymentBlocks = built.document.qrBlocks.filter((b) => b.kind === "PAYMENT");
    expect(paymentBlocks).toHaveLength(1);
    const block = paymentBlocks[0]!;
    if (block.kind !== "PAYMENT") return;
    expect(block.amountMinor).toBe(123456);
    expect(block.currency).toBe("THB");
    expect(block.receiverLabel).toBe("ร้านไทยพรีเมียร์");
    expect(block.caption).toContain("สแกนชำระเงิน");
    expect(built.snapshotHasPaymentQr).toBe(true);
    expect(built.qrConfigVersion).toBe(3);
    // Payload validates against the same receiver + amount.
    expect(block.payload).toBe(
      buildPromptPayPayload({ receiverType: "MOBILE", receiverValue: "0812345678", amountMinor: 123456 }),
    );
  });

  it("PAID payment -> no PAYMENT block (receipts never carry payment QR)", () => {
    const built = build({
      kind: "RECEIPT",
      payment: { status: "PAID", receiptNo: "RC-0001" },
    });
    expect(built.document.qrBlocks.some((b) => b.kind === "PAYMENT")).toBe(false);
    expect(built.snapshotHasPaymentQr).toBe(false);
    expect(built.qrConfigVersion).toBeNull();
  });

  it("zero amount -> no PAYMENT block", () => {
    const built = build({
      payment: { amount: decimal("0") },
    });
    expect(built.document.qrBlocks.some((b) => b.kind === "PAYMENT")).toBe(false);
    expect(built.snapshotHasPaymentQr).toBe(false);
  });

  it("disabled setting or missing receiver value -> block omitted, never fallback", () => {
    const disabled = build({ setting: { paymentQrEnabled: false } });
    expect(disabled.document.qrBlocks.some((b) => b.kind === "PAYMENT")).toBe(false);

    const noReceiver = build({});
    const withoutReceiverValue = buildPrintDocument({
      kind: "QUOTATION",
      payment: makePayment(),
      setting: APP_SETTING,
      receiverValue: null, // decryption failed upstream
      now: new Date("2026-06-01T03:00:00.000Z"),
    });
    expect(noReceiver.document.qrBlocks.some((b) => b.kind === "PAYMENT")).toBe(true);
    expect(withoutReceiverValue.document.qrBlocks.some((b) => b.kind === "PAYMENT")).toBe(false);
  });
});

describe("document content", () => {
  it("orders quotation information and summary rows like the canonical document", () => {
    const document = buildPrintDocument({
      kind: "QUOTATION",
      payment: makePayment({ createdAt: new Date("2026-09-04T13:18:00.000Z") }),
      setting: APP_SETTING,
      receiverValue: null,
      now: new Date("2026-09-04T14:00:00.000Z"),
    }).document;

    expect(document.informationRows).toEqual([
      { label: "เลขที่ใบแจ้งราคา", value: "QT-0001" },
      { label: "เลขรับผ้า", value: "ORD-0001" },
      { label: "วันที่ออก", value: "4/9/2026 20:18" },
      { label: "วันนัดรับ", value: "ไม่ระบุ" },
      { label: "ชื่อลูกค้า", value: "ลูกค้า ตัวอย่าง" },
      { label: "โทร", value: "0812345678" },
    ]);
    expect(document.summaryRows).toEqual([
      { label: "รวมจำนวนรายการ", value: "3 ชิ้น" },
      { label: "ราคา", value: "1,234.56" },
      { label: "ส่วนลด", value: "0.00" },
    ]);
  });

  it("builds line items and totals in minor units from the service order", () => {
    const built = buildPrintDocument({
      kind: "RECEIPT",
      payment: makePayment({ receiptNo: "RC-0001" }),
      setting: { ...APP_SETTING, lineQrEnabled: true },
      receiverValue: null,
      now: new Date("2026-06-01T03:00:00.000Z"),
    });
    const document: PrintDocument = built.document;
    expect(document.kind).toBe("RECEIPT");
    expect(document.documentNo).toBe("RC-0001");
    expect(document.items).toHaveLength(2);
    expect(document.items[0]).toMatchObject({ name: "ซัก เสื้อ", unitPriceMinor: 60000, totalPriceMinor: 120000 });
    expect(document.totals).toEqual({
      subtotalAmountMinor: 123456,
      discountAmountMinor: 0,
      totalAmountMinor: 123456,
    });
    // LINE QR defaults to receipts (payment QR to quotations).
    expect(document.qrBlocks.map((b) => b.kind)).toEqual(["LINE"]);
    expect(built.sourceRevision).toBe(new Date("2026-06-01T03:00:00.000Z").getTime());
  });

  it("shows the receipt LINE QR whenever an image is configured, without a separate toggle", () => {
    const document = buildPrintDocument({
      kind: "RECEIPT",
      payment: makePayment(),
      setting: { ...APP_SETTING, lineQrEnabled: false },
      receiverValue: null,
      now: new Date("2026-06-01T03:00:00.000Z"),
    }).document;

    expect(document.qrBlocks.map((block) => block.kind)).toEqual(["LINE"]);
  });

  it("preserves the established receipt fields from service-order business data", () => {
    const base = makePayment();
    const built = buildPrintDocument({
      kind: "RECEIPT",
      payment: makePayment({
        status: "PAID",
        receiptNo: "RC-0001",
        createdAt: new Date("2026-09-03T01:00:00.000Z"),
        paidAt: new Date("2026-09-03T02:00:00.000Z"),
        confirmedAt: new Date("2026-09-03T02:05:00.000Z"),
        method: "TRANSFER",
        metadata: { vat: { rate: 7, amount: 80.75, included: true, baseAmount: 1153.81 } },
        note: null,
        serviceOrder: {
          ...base.serviceOrder!,
          status: "PROCESSING",
          receivedAt: new Date("2026-09-02T01:30:00.000Z"),
          dueAt: new Date("2026-09-05T10:00:00.000Z"),
          washFoldPricePerKgSnapshot: null,
          employee: { name: "พนักงานหนึ่ง" },
          hangerCharge: { count: 3, pricePerUnit: 5, total: 15 },
          note: "ระวังสีตก\nแยกซัก",
          memberEntitlement: {
            product: { name: "แพ็กเกจรายเดือน 30 ชิ้น" },
            creditInitial: 30,
            creditRemaining: 25,
            endAt: new Date("2026-10-01T00:00:00.000Z"),
          },
          addonUsageRecords: [{ productName: "บริการรับ-ส่ง", credits: 1 }],
          usageHistory: [{
            orderNo: "ORD-0001",
            receivedAt: new Date("2026-09-02T01:30:00.000Z"),
            quantity: 3,
            isCurrent: true,
          }],
        },
      }),
      setting: { ...APP_SETTING, lineQrEnabled: false },
      receiverValue: null,
      now: new Date("2026-09-04T03:00:00.000Z"),
    }).document;

    expect(built.issuedAt).toBe("2026-09-03T01:00:00.000Z");
    expect(built.title).toBe("ใบเสร็จรับเงิน");
    expect(built.totalDisplay).toEqual({ label: "รวมทั้งสิ้น", value: "1,234.56" });
    expect(built.note).toBe("ระวังสีตก\nแยกซัก");
    expect(built.informationRows).toEqual(expect.arrayContaining([
      { label: "เลขรับผ้า", value: "ORD-0001" },
      { label: "วันนัดรับ", value: "5/9/2026 17:00" },
      { label: "แพ็กเกจ", value: "แพ็กเกจรายเดือน 30 ชิ้น" },
      { label: "พนักงาน", value: "พนักงานหนึ่ง" },
      { label: "ช่องทางการชำระเงิน", value: "โอนเงิน" },
      { label: "วันที่ชำระเงิน", value: "3/9/2026 09:05" },
    ]));
    expect(built.summaryRows).toEqual(expect.arrayContaining([
      { label: "รวมจำนวนรายการ", value: "3 ชิ้น" },
      { label: "รวมไม้แขวน", value: "3 ชิ้น" },
      { label: "ค่าไม้แขวน", value: "15.00" },
      { label: "ราคารวม VAT 7% แล้ว", value: "1,153.81" },
      { label: "VAT 7%", value: "80.75" },
    ]));
    expect(built.supplementalSections).toEqual([
      { title: "แพ็กเกจเสริม", lines: ["บริการรับ-ส่ง 1 เครดิต"] },
      {
        title: "สรุปการใช้บริการ",
        lines: expect.arrayContaining([
          "ครั้งที่ 1* 2/9/2026 3 ชิ้น",
          "รวม 3 ชิ้น",
          "คงเหลือ 25/30 เครดิต",
          "หมดอายุ 1/10/2026",
        ]),
      },
    ]);
  });

  it("uses the established package-covered receipt title and total text", () => {
    const base = makePayment();
    const document = buildPrintDocument({
      kind: "RECEIPT",
      payment: makePayment({
        status: "PAID",
        amount: decimal("0"),
        serviceOrder: {
          ...base.serviceOrder!,
          memberEntitlement: {
            product: { name: "แพ็กเกจรายเดือน" },
            creditInitial: 30,
            creditRemaining: 29,
            endAt: null,
          },
        },
      }),
      setting: { ...APP_SETTING, lineQrEnabled: false },
      receiverValue: null,
      now: new Date("2026-09-04T03:00:00.000Z"),
    }).document;

    expect(document.title).toBe("ใบแจ้งการใช้บริการ");
    expect(document.totalDisplay).toEqual({ label: "รวมทั้งสิ้น", value: "ใช้สิทธิ์แพ็กเกจ" });
  });

  it("falls back to the legacy shop row for identity fields", () => {
    const built = buildPrintDocument({
      kind: "RECEIPT",
      payment: makePayment({ serviceOrder: null, packageSale: null }),
      setting: { ...APP_SETTING, name: null, phone: null, address: null, lineQrImageUrl: null },
      legacyShop: {
        name: "ชื่อเดิม",
        phone: "02-999-9999",
        address: "ที่อยู่เดิม",
        lineQrImageUrl: null,
      },
      receiverValue: null,
      now: new Date("2026-06-01T03:00:00.000Z"),
    });
    expect(built.document.shop).toEqual({
      name: "ชื่อเดิม",
      addressLine: "ที่อยู่เดิม",
      phoneNumber: "02-999-9999",
      taxId: null,
      logoUrl: "/logo-saijai-phareab.png",
    });
  });

  it("maps AppSetting QR fields into the frozen snapshot shape", () => {
    const snapshot = buildPaymentQrSettingSnapshot({
      ...APP_SETTING,
      paymentQrEnabled: null,
      paymentQrConfigVersion: null,
      paymentQrActivatedAt: null,
      lineQrEnabled: null,
    });
    expect(snapshot).toMatchObject({
      paymentQrEnabled: false,
      paymentQrConfigVersion: 0,
      paymentQrActivatedAt: null,
      lineQrEnabled: true, // falls back to lineQrImageUrl presence
      paymentQrReceiverType: "MOBILE",
      paymentQrProvider: "PROMPTPAY_LOCAL",
    });
  });
});
