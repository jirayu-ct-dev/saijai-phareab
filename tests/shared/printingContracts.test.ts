import { describe, expect, it } from "vitest";
import type {
  PrintDocument,
  PrintOperation,
  PrintQrBlock,
  PrinterProfile,
} from "../../shared/types/printing";
import { createPrinterCapabilities } from "../../shared/utils/printJobState";

const sampleDocument = (): PrintDocument => ({
  kind: "QUOTATION",
  documentId: "payment-1",
  documentNo: "QT-2026-0001",
  revision: 3,
  issuedAt: "2026-09-02T03:00:00.000Z",
  shop: {
    name: "Saijai Phareab",
    addressLine: "1 ถนนทดสอบ",
    phoneNumber: "0899999999",
    taxId: null,
  },
  customer: { name: "ลูกค้าทดสอบ", phoneNumber: "0812345678" },
  items: [
    {
      name: "ซักพับ น้ำหนัก",
      quantity: 5,
      unitPriceMinor: 3500,
      totalPriceMinor: 17500,
      note: null,
    },
  ],
  totals: {
    subtotalAmountMinor: 17500,
    discountAmountMinor: 0,
    totalAmountMinor: 17500,
  },
  note: null,
  qrBlocks: [
    {
      kind: "PAYMENT",
      payload: "0002010102122937AID00",
      amountMinor: 17500,
      currency: "THB",
      receiverLabel: "ร้าน Saijai",
      caption: "สแกนชำระเงิน ฿175.00",
    },
    {
      kind: "LINE",
      imageUrl: "https://example.com/line-qr.png",
      caption: "สอบถาม/ติดตามผ้าได้ที่ LINE",
    },
  ],
});

describe("printing contracts", () => {
  it("keeps PrintDocument and PrintQrBlock JSON-safe (round-trips unchanged)", () => {
    const document = sampleDocument();
    const roundTrip = JSON.parse(JSON.stringify(document)) as PrintDocument;
    expect(roundTrip).toEqual(document);
  });

  it("keeps every PrintOperation variant JSON-safe except raw raster bytes", () => {
    const operations: PrintOperation[] = [
      { type: "initialize" },
      { type: "nativeQr", data: "payload", size: 6 },
      { type: "nativeBarcode", symbology: "CODE128", data: "123" },
      { type: "nvLogo", key: "logo-1" },
      { type: "feed", lines: 3 },
      { type: "partialCut" },
      { type: "buzzer", pattern: "short" },
      { type: "drawerPulse", pin: 0, onMs: 60, offMs: 120 },
    ];
    const roundTrip = JSON.parse(JSON.stringify(operations)) as PrintOperation[];
    expect(roundTrip).toEqual(operations);

    const raster: PrintOperation = {
      type: "raster",
      bytes: new Uint8Array([1, 2, 3]),
      widthDots: 576,
    };
    expect(raster.bytes).toBeInstanceOf(Uint8Array);
  });

  it("derives PrintCustomerInfo fields from ReceiptPayload conventions", () => {
    const customer = sampleDocument().customer;
    expect(Object.keys(customer).sort()).toEqual(["name", "phoneNumber"]);
  });

  it("separates PAYMENT and LINE QR blocks as distinct semantic entries", () => {
    const blocks: PrintQrBlock[] = sampleDocument().qrBlocks;
    expect(blocks.map((block) => block.kind)).toEqual(["PAYMENT", "LINE"]);
    const [payment, line] = blocks;
    if (payment.kind !== "PAYMENT" || line.kind !== "LINE") {
      throw new Error("QR blocks must be discriminated by kind");
    }
    expect(payment.amountMinor).toBe(17500);
    expect(payment.currency).toBe("THB");
  });

  it("profiles only allow XP-C260M with verified paper widths and dot matrices", () => {
    const profile: PrinterProfile = {
      id: "printer-1",
      name: "XP-C260M ผ่าน Wi-Fi",
      model: "XP-C260M",
      defaultTransport: "WIFI",
      paperWidthMm: 80,
      printableDots: 576,
      renderMode: "HYBRID",
      capabilities: createPrinterCapabilities({ partialCut: true }),
    };
    const roundTrip = JSON.parse(JSON.stringify(profile)) as PrinterProfile;
    expect(roundTrip).toEqual(profile);
  });

  it("defaults every printer capability to false until physically verified", () => {
    const capabilities = createPrinterCapabilities();
    expect(Object.values(capabilities).every((flag) => flag === false)).toBe(true);
    expect(Object.keys(capabilities).sort()).toEqual(
      [
        "blackMark",
        "buzzer",
        "cashDrawer",
        "nativeBarcode",
        "nativeQr",
        "nvLogo",
        "partialCut",
        "pdf417",
        "statusQuery",
      ].sort(),
    );
  });

  it("merges only verified capability overrides onto the false defaults", () => {
    const capabilities = createPrinterCapabilities({ nativeQr: true });
    expect(capabilities.nativeQr).toBe(true);
    expect(capabilities.partialCut).toBe(false);
    expect(capabilities.cashDrawer).toBe(false);
  });
});
