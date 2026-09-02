import { describe, expect, it } from "vitest";
import type { PrintDocument, PrinterProfile } from "../../shared/types/printing";
import { createPrinterCapabilities } from "../../shared/utils/printJobState";
import {
  composePrintOperations,
  formatPrintIssuedAt,
  formatMinor,
} from "../../shared/utils/printComposer";

const sampleProfile = (overrides: Partial<PrinterProfile> = {}): PrinterProfile => ({
  id: "printer-1",
  name: "ครัวหน้าร้าน",
  model: "XP-C260M",
  defaultTransport: "WIFI",
  paperWidthMm: 80,
  printableDots: 576,
  renderMode: "HYBRID",
  capabilities: createPrinterCapabilities({ partialCut: true, nativeQr: true }),
  ...overrides,
});

const sampleDocument = (overrides: Partial<PrintDocument> = {}): PrintDocument => ({
  kind: "QUOTATION",
  documentId: "payment-1",
  documentNo: "QT-2026-0001",
  revision: 1,
  issuedAt: "2026-09-03T03:30:00.000Z",
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
  ],
  ...overrides,
});

describe("printComposer", () => {
  it("starts with initialize and ends with feed then partialCut when capable", () => {
    const { operations } = composePrintOperations(sampleDocument(), sampleProfile());
    expect(operations[0]).toEqual({ type: "initialize" });
    expect(operations.at(-1)).toEqual({ type: "partialCut" });
    expect(operations.at(-2)).toEqual({ type: "feed", lines: 4 });
  });

  it("omits partialCut when the capability is not verified but still feeds", () => {
    const profile = sampleProfile({
      capabilities: createPrinterCapabilities({ nativeQr: true }),
    });
    const { operations } = composePrintOperations(sampleDocument(), profile);
    expect(operations.some((op) => op.type === "partialCut")).toBe(false);
    expect(operations.at(-1)).toEqual({ type: "feed", lines: 4 });
  });

  it("composes Thai document text via text operations", () => {
    const { operations } = composePrintOperations(sampleDocument(), sampleProfile());
    const text = operations
      .filter((op) => op.type === "text")
      .map((op) => (op as { value: string }).value)
      .join("\n");
    expect(text).toContain("Saijai Phareab");
    expect(text).toContain("ใบเสนอราคา");
    expect(text).toContain("เลขที่: QT-2026-0001");
    expect(text).toContain("ลูกค้า: ลูกค้าทดสอบ");
    expect(text).toContain("175.00");
    expect(text).not.toContain("ใบเสร็จรับเงิน");
  });

  it("uses the receipt title for RECEIPT documents", () => {
    const { operations } = composePrintOperations(
      sampleDocument({ kind: "RECEIPT" }),
      sampleProfile(),
    );
    const text = operations
      .filter((op) => op.type === "text")
      .map((op) => (op as { value: string }).value)
      .join("\n");
    expect(text).toContain("ใบเสร็จรับเงิน");
  });

  it("formats dates in Asia/Bangkok time from the ISO instant", () => {
    // 2026-09-03T03:30Z is 10:30 in Bangkok (+7).
    expect(formatPrintIssuedAt("2026-09-03T03:30:00.000Z")).toBe("3/9/2026 10:30");
  });

  // ============================
  // QR: native / raster fallback / skip (same payload both paths)
  // ============================

  it("emits nativeQr with the exact document payload when capable", () => {
    const { operations } = composePrintOperations(sampleDocument(), sampleProfile());
    const nativeQr = operations.find((op) => op.type === "nativeQr");
    expect(nativeQr).toEqual({
      type: "nativeQr",
      data: "0002010102122937AID00",
      size: 6,
    });
    expect(operations.some((op) => op.type === "raster")).toBe(false);
  });

  it("falls back to a raster with the SAME payload when native QR is unsupported", () => {
    let receivedPayload: string | null = null;
    let receivedTarget: string | null = null;
    const bitmap = { bytes: new Uint8Array(24 * 12).fill(0xaa), widthDots: 96 };
    const profile = sampleProfile({
      capabilities: createPrinterCapabilities({ partialCut: true }),
    });
    const { operations } = composePrintOperations(sampleDocument(), profile, {
      bitmapFor: (payload, target) => {
        receivedPayload = payload;
        receivedTarget = target;
        return bitmap;
      },
    });
    expect(receivedPayload).toBe("0002010102122937AID00");
    expect(receivedTarget).toBe("PAYMENT_QR");
    const rasters = operations.filter((op) => op.type === "raster");
    expect(rasters).toHaveLength(1);
    expect(rasters[0]).toEqual({ type: "raster", bytes: bitmap.bytes, widthDots: 96 });
    expect(operations.some((op) => op.type === "nativeQr")).toBe(false);
  });

  it("skips the QR block and records it in the report when no bitmap is available", () => {
    const profile = sampleProfile({
      capabilities: createPrinterCapabilities({ partialCut: true }),
    });
    const { operations, report } = composePrintOperations(sampleDocument(), profile);
    expect(operations.some((op) => op.type === "nativeQr")).toBe(false);
    expect(operations.some((op) => op.type === "raster")).toBe(false);
    expect(report.skippedQrBlocks).toEqual([
      { kind: "PAYMENT", reason: "NO_NATIVE_QR_AND_NO_BITMAP" },
    ]);
    // The caption is still printed so the receipt stays understandable.
    const text = operations
      .filter((op) => op.type === "text")
      .map((op) => (op as { value: string }).value)
      .join("\n");
    expect(text).toContain("สแกนชำระเงิน ฿175.00");
  });

  it("routes LINE QR through the bitmap provider with the imageUrl payload", () => {
    const calls: Array<[string, string]> = [];
    const bitmap = { bytes: new Uint8Array(8 * 12), widthDots: 96 };
    const profile = sampleProfile({
      capabilities: createPrinterCapabilities({ nativeQr: true }),
    });
    const { operations, report } = composePrintOperations(
      sampleDocument({
        qrBlocks: [
          {
            kind: "LINE",
            imageUrl: "https://example.com/line-qr.png",
            caption: "สอบถาม/ติดตามผ้าได้ที่ LINE",
          },
        ],
      }),
      profile,
      {
        bitmapFor: (payload, target) => {
          calls.push([target, payload]);
          return bitmap;
        },
      },
    );
    expect(calls).toEqual([["LINE_QR", "https://example.com/line-qr.png"]]);
    // LINE QR is image-based and never encoded as a native QR command.
    expect(operations.some((op) => op.type === "nativeQr")).toBe(false);
    expect(operations.some((op) => op.type === "raster")).toBe(true);
    expect(report.skippedQrBlocks).toEqual([]);
  });

  it("records a too-wide bitmap as skipped instead of failing the receipt", () => {
    const profile = sampleProfile({
      capabilities: createPrinterCapabilities({ nativeQr: true }),
    });
    const { operations, report } = composePrintOperations(
      sampleDocument({
        qrBlocks: [
          {
            kind: "LINE",
            imageUrl: "https://example.com/line-qr.png",
            caption: "LINE",
          },
        ],
      }),
      profile,
      {
        bitmapFor: () => ({ bytes: new Uint8Array(0), widthDots: 1024 }),
      },
    );
    expect(operations.some((op) => op.type === "raster")).toBe(false);
    expect(report.skippedQrBlocks).toEqual([{ kind: "LINE", reason: "NO_BITMAP_PROVIDER" }]);
  });

  // ============================
  // Band splitting
  // ============================

  it("splits tall bitmaps into bands of the requested height", () => {
    // 120-dot tall bitmap, 96 dots wide (12 bytes per row), 64-dot bands.
    const bitmap = { bytes: new Uint8Array(120 * 12), widthDots: 96 };
    const profile = sampleProfile({
      capabilities: createPrinterCapabilities({ partialCut: true }),
    });
    const { operations } = composePrintOperations(sampleDocument(), profile, {
      bitmapFor: () => bitmap,
      bandHeightDots: 64,
    });
    const rasters = operations.filter((op) => op.type === "raster");
    expect(rasters).toHaveLength(2);
    expect((rasters[0] as { bytes: Uint8Array }).bytes).toHaveLength(64 * 12);
    expect((rasters[1] as { bytes: Uint8Array }).bytes).toHaveLength(56 * 12);
    expect(rasters.map((op) => (op as { widthDots: number }).widthDots)).toEqual([96, 96]);
  });

  it("returns a JSON-safe report with the printable width", () => {
    const { report } = composePrintOperations(sampleDocument(), sampleProfile());
    expect(report.textEncoding).toBe("TIS620");
    expect(report.widthDots).toBe(576);
    expect(report.skippedQrBlocks).toEqual([]);
    const roundTrip = JSON.parse(JSON.stringify(report)) as typeof report;
    expect(roundTrip).toEqual(report);
  });

  // ============================
  // Money display (C10: display-only, integer math)
  // ============================

  describe("formatMinor", () => {
    it("formats integer minor units without floats", () => {
      expect(formatMinor(123450)).toBe("1,234.50");
      expect(formatMinor(0)).toBe("0.00");
      expect(formatMinor(5)).toBe("0.05");
      expect(formatMinor(50)).toBe("0.50");
      expect(formatMinor(1)).toBe("0.01");
      expect(formatMinor(1000000000)).toBe("10,000,000.00");
      expect(formatMinor(17500)).toBe("175.00");
    });

    it("handles negative amounts and rejects fractional input", () => {
      expect(formatMinor(-123456)).toBe("-1,234.56");
      expect(() => formatMinor(1234.5)).toThrow();
    });
  });
});
