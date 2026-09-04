import { describe, expect, it } from "vitest";
import type { PrintDocument, PrinterProfile } from "../../shared/types/printing";
import { createPrinterCapabilities } from "../../shared/utils/printCapabilities";
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
  it("places the configured raster logo before the shop heading", () => {
    const logoBitmap = { bytes: new Uint8Array(72 * 8).fill(0xff), widthDots: 576 };
    const { operations } = composePrintOperations(sampleDocument(), sampleProfile(), { logoBitmap });

    expect(operations[0]).toEqual({ type: "initialize" });
    expect(operations[1]).toEqual({ type: "raster", ...logoBitmap });
    expect(operations[2]).toEqual(expect.objectContaining({
      type: "text",
      value: "Saijai Phareab",
      align: "center",
    }));
  });

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
    expect(text).toContain("เลขที่ใบแจ้งราคา:");
    expect(text).toContain("QT-2026-0001");
    expect(text).toContain("ชื่อลูกค้า:");
    expect(text).toContain("ลูกค้าทดสอบ");
    expect(text).toContain("175.00");
    expect(text).not.toContain("ใบเสร็จรับเงิน");
  });

  it("prints every server-owned information, summary and supplemental line", () => {
    const { operations } = composePrintOperations(sampleDocument({
      informationRows: [
        { label: "เลขรับผ้า", value: "ORD-2026-0001" },
        { label: "วันนัดรับ", value: "4/9/2026 17:30" },
        { label: "พนักงาน", value: "คุณใจดี" },
      ],
      summaryRows: [
        { label: "รวมจำนวนรายการ", value: "5 ชิ้น" },
        { label: "ค่าไม้แขวน", value: "20.00" },
        { label: "VAT 7%", value: "11.45" },
      ],
      supplementalSections: [{
        title: "แพ็กเกจเสริม",
        lines: ["รับ-ส่ง 1 เครดิต", "ซักผ้านวม 2 เครดิต"],
      }],
      footerLines: ["ขอบคุณที่ไว้วางใจใช้บริการ", "เอกสารนี้เป็นใบแจ้งราคาเท่านั้น"],
    }), sampleProfile());
    const text = operations
      .filter((operation) => operation.type === "text")
      .map((operation) => operation.value)
      .join("\n");

    for (const expected of [
      "เลขรับผ้า", "ORD-2026-0001", "วันนัดรับ", "4/9/2026 17:30", "พนักงาน",
      "รวมจำนวนรายการ", "5 ชิ้น", "ค่าไม้แขวน", "VAT 7%", "แพ็กเกจเสริม",
      "รับ-ส่ง 1 เครดิต", "ซักผ้านวม 2 เครดิต", "ขอบคุณที่ไว้วางใจใช้บริการ",
      "เอกสารนี้เป็นใบแจ้งราคาเท่านั้น",
    ]) expect(text).toContain(expected);
  });

  it("keeps canonical information rows as left/right columns", () => {
    const informationRows = [
      { label: "เลขที่ใบแจ้งราคา", value: "QT-2026-0003" },
      { label: "เลขรับผ้า", value: "ORD-20260904-9IB7TH" },
      { label: "วันนัดรับ", value: "ไม่ระบุ" },
    ];
    const { operations } = composePrintOperations(sampleDocument({ informationRows }), sampleProfile());

    expect(operations.filter((operation) => operation.type === "text" && operation.columns))
      .toEqual(expect.arrayContaining(informationRows.map((row) => expect.objectContaining({
        columns: { left: `${row.label}:`, right: row.value },
      }))));
  });

  it("composes the receipt item header and every item as four positioned columns", () => {
    const { operations } = composePrintOperations(sampleDocument({
      items: [{
        name: "ซัก-พับ กระโปรงยาว / พลิ้ว",
        quantity: 4,
        unitPriceMinor: 2_000,
        totalPriceMinor: 8_000,
        note: "ผ้าบาง",
      }],
    }), sampleProfile());
    const tableRows = operations
      .filter((operation) => operation.type === "text" && operation.tableColumns)
      .map((operation) => operation.tableColumns);

    expect(tableRows).toEqual([
      { item: "รายการ", unitPrice: "ราคา/ชิ้น", quantity: "จำนวน", total: "รวม" },
      {
        item: "ซัก-พับ กระโปรงยาว / พลิ้ว\nผ้าบาง",
        unitPrice: "20.00",
        quantity: "x4",
        total: "80.00",
      },
    ]);
  });

  it("emphasizes the final total as a large left/right row", () => {
    const { operations } = composePrintOperations(sampleDocument({
      totalDisplay: { label: "ยอดที่ต้องชำระ", value: "354.00" },
    }), sampleProfile());

    const totalIndex = operations.findIndex((operation) => operation.type === "text"
      && operation.columns?.left === "ยอดที่ต้องชำระ");

    expect(operations[totalIndex]).toEqual(expect.objectContaining({
      type: "text",
      style: "large",
      columns: { left: "ยอดที่ต้องชำระ", right: "354.00" },
    }));
    expect(operations[totalIndex - 1]).toEqual(expect.objectContaining({
      type: "text",
      value: "------------------------------------------------",
    }));
    expect(operations[totalIndex + 1]).toEqual(expect.objectContaining({
      type: "text",
      value: "------------------------------------------------",
    }));
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

  it("uses the server-owned document title and package-covered total display", () => {
    const { operations } = composePrintOperations(sampleDocument({
      kind: "RECEIPT",
      title: "ใบแจ้งการใช้บริการ",
      totalDisplay: { label: "รวมทั้งสิ้น", value: "ใช้สิทธิ์แพ็กเกจ" },
    }), sampleProfile());
    const text = operations
      .filter((operation) => operation.type === "text")
      .map((operation) => operation.value)
      .join("\n");
    expect(text).toContain("ใบแจ้งการใช้บริการ");
    expect(text).toContain("รวมทั้งสิ้น");
    expect(text).toContain("ใช้สิทธิ์แพ็กเกจ");
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
    expect(report.textEncoding).toBe("ASCII_NATIVE_THAI_RASTER");
    expect(report.widthDots).toBe(576);
    expect(report.skippedQrBlocks).toEqual([]);
    const roundTrip = JSON.parse(JSON.stringify(report)) as typeof report;
    expect(roundTrip).toEqual(report);
  });

  it("keeps receipt totals as semantic columns for accurate raster alignment", () => {
    const { operations } = composePrintOperations(sampleDocument(), sampleProfile());
    const total = operations.find(
      (operation) => operation.type === "text" && operation.columns?.left === "ยอดรวม",
    );
    expect(total).toMatchObject({
      type: "text",
      style: "large",
      columns: { left: "ยอดรวม", right: "175.00" },
    });
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
