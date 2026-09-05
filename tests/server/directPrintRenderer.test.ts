import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrintDocument } from "../../shared/types/printing";
import {
  createDirectPrinterProfile,
  rasterizeThaiOperations,
  renderDirectEscpos,
} from "../../server/utils/directPrintRenderer";
import { encodeEscpos } from "../../shared/utils/escpos";

beforeAll(async () => {
  const assets = new Map<string, Buffer>(await Promise.all([
    "fonts/Prompt-normal-400-thai.woff2",
    "fonts/Prompt-normal-700-thai.woff2",
    "logo-saijai-phareab.png",
  ].map(async (key) => [key, await readFile(path.join(process.cwd(), "public", key))] as const)));
  vi.stubGlobal("useStorage", () => ({
    getItemRaw: async (key: string) => assets.get(key) ?? null,
  }));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const documentFixture = (): PrintDocument => ({
  kind: "QUOTATION",
  documentId: "payment-1",
  documentNo: "QT-0001",
  revision: 1,
  issuedAt: "2026-09-03T10:00:00.000Z",
  shop: { name: "ร้านไสใจ", addressLine: null, phoneNumber: "0800000000", taxId: null },
  customer: { name: "ลูกค้าทดสอบ", phoneNumber: null },
  items: [{ name: "ซักพับ", quantity: 1, unitPriceMinor: 12500, totalPriceMinor: 12500, note: null }],
  totals: { subtotalAmountMinor: 12500, discountAmountMinor: 0, totalAmountMinor: 12500 },
  note: null,
  qrBlocks: [{
    kind: "PAYMENT",
    payload: "00020101021229370016A0000006770101110113006689123456753037645406125.005802TH6304D07F",
    amountMinor: 12500,
    currency: "THB",
    receiverLabel: "ร้านไสใจ",
    caption: "สแกนชำระเงิน 125.00 บาท",
  }],
});

function bitmapStats(operations: Awaited<ReturnType<typeof rasterizeThaiOperations>>) {
  let rows = 0;
  let blackPixels = 0;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = -1;
  for (const operation of operations) {
    if (operation.type !== "raster") continue;
    const rowBytes = Math.ceil(operation.widthDots / 8);
    const bandRows = operation.bytes.length / rowBytes;
    for (let y = 0; y < bandRows; y += 1) {
      for (let x = 0; x < operation.widthDots; x += 1) {
        const value = operation.bytes[y * rowBytes + (x >> 3)] ?? 0;
        if ((value & (1 << (7 - (x & 7)))) === 0) continue;
        blackPixels += 1;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
    rows += bandRows;
  }
  return { rows, blackPixels, minX, maxX };
}

describe("direct Hybrid renderer", () => {
  it("enables only the cutter capability verified on the physical XP-C260M", () => {
    const profile = createDirectPrinterProfile(576);
    expect(profile.renderMode).toBe("HYBRID");
    expect(profile.capabilities.partialCut).toBe(true);
    expect(Object.entries(profile.capabilities).filter(([, value]) => value).map(([key]) => key))
      .toEqual(["partialCut"]);
  });

  it("places exactly one cut command at the very end of each rendered document", async () => {
    const rendered = await renderDirectEscpos(documentFixture(), 576);
    const cut = Buffer.from([0x1d, 0x56, 0x42, 0x00]);
    const bytes = Buffer.from(rendered.bytes);
    let count = 0;
    for (let index = 0; index <= bytes.length - cut.length; index += 1) {
      if (bytes.subarray(index, index + cut.length).equals(cut)) count += 1;
    }
    expect(count).toBe(1);
    expect(bytes.subarray(-cut.length)).toEqual(cut);
    expect(bytes.subarray(-(cut.length + 3), -cut.length)).toEqual(Buffer.from([0x1b, 0x64, 0x04]));
  });

  it("uses block rasterization as the default Thai strategy", async () => {
    const first = await renderDirectEscpos(documentFixture(), 576);
    const second = await renderDirectEscpos(documentFixture(), 576);

    expect(first.bytes).toEqual(second.bytes);
    expect(first.bytes.byteLength).toBeGreaterThan(1000);
    expect(Array.from(first.bytes.slice(0, 2))).toEqual([0x1b, 0x40]);
    expect(Array.from(first.bytes.slice(0, 5))).not.toEqual([0x1b, 0x40, 0x1b, 0x74, 0x46]);
    expect(first.thaiStrategy).toBe("raster-thai");
    expect(first.report.textEncoding).toBe("ASCII_NATIVE_THAI_RASTER");
    const hex = Buffer.from(first.bytes).toString("hex");
    expect(hex.match(/1d763000/g)?.length).toBeGreaterThan(1);
    expect(first.report.skippedQrBlocks).toEqual([]);
  });

  it("renders the committed shop logo as a raster block before the document", async () => {
    const withoutLogo = await renderDirectEscpos(documentFixture(), 576);
    const withLogo = await renderDirectEscpos({
      ...documentFixture(),
      shop: { ...documentFixture().shop, logoUrl: "/logo-saijai-phareab.png" },
    }, 576);

    const rasterCount = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex").match(/1d763000/g)?.length ?? 0;
    expect(withLogo.bytes.byteLength).toBeGreaterThan(withoutLogo.bytes.byteLength);
    expect(rasterCount(withLogo.bytes)).toBeGreaterThan(rasterCount(withoutLogo.bytes));
  });

  it("pads payment QR raster blocks to the full paper width so they print centered", async () => {
    const rendered = await renderDirectEscpos(documentFixture(), 576);
    const hex = Buffer.from(rendered.bytes).toString("hex");

    expect(hex).toContain("1d7630004800");
    expect(hex).not.toContain("1d7630002301");
  });

  it("keeps native code pages diagnostic-only", async () => {
    const native874 = await renderDirectEscpos(documentFixture(), 576, "native-cp874");
    expect(native874.thaiStrategy).toBe("native-cp874");
    expect(native874.report.textEncoding).toBe("CP874");
    expect(Array.from(native874.bytes.slice(0, 5))).toEqual([0x1b, 0x40, 0x1b, 0x74, 0x46]);

    const native255 = await renderDirectEscpos(documentFixture(), 576, "native-thai-255");
    expect(native255.thaiStrategy).toBe("native-thai-255");
    expect(native255.report.textEncoding).toBe("THAI_PAGE_255");
    expect(Array.from(native255.bytes.slice(0, 5))).toEqual([0x1b, 0x40, 0x1b, 0x74, 0xff]);
  });

  it.each([
    "ทดสอบภาษาไทย",
    "ขอบคุณที่ใช้บริการ",
    "น้ำแข็ง",
    "กุ้ง",
    "ไข่ดาว",
    "ข้าวผัด",
    "ราคา 105.00 บาท",
    "ใบเสร็จ RC-2026-0003",
    "ลูกค้า: สมชาย ใจดี",
    "โทร: 081-234-5678",
    "รวมทั้งหมด 105.00 บาท",
  ])("rasterizes Thai or mixed text without leaving native Thai text: %s", async (value) => {
    const profile = createDirectPrinterProfile(576);
    const operations = await rasterizeThaiOperations([{ type: "text", value }], profile);

    expect(operations.length).toBeGreaterThan(0);
    expect(operations.every((operation) => operation.type === "raster")).toBe(true);
    for (const operation of operations) {
      if (operation.type !== "raster") continue;
      expect(operation.widthDots).toBeLessThanOrEqual(576);
      expect(operation.bytes.byteLength).toBeGreaterThan(0);
      expect(operation.bytes.some((byte) => byte !== 0)).toBe(true);
      expect(operation.bytes.byteLength / Math.ceil(operation.widthDots / 8)).toBeLessThanOrEqual(64);
    }
  });

  it("keeps ASCII-only text native for speed", async () => {
    const profile = createDirectPrinterProfile(576);
    const operations = await rasterizeThaiOperations([
      { type: "text", value: "RC-2026-0003 105.00", style: "bold", align: "right" },
      { type: "feed", lines: 2 },
    ], profile);

    expect(operations).toEqual([
      { type: "text", value: "RC-2026-0003 105.00", style: "bold", align: "right" },
      { type: "feed", lines: 2 },
    ]);
  });

  it("honors left, center and right alignment inside the 576-dot bitmap", async () => {
    const profile = createDirectPrinterProfile(576);
    const [left, center, right] = await Promise.all(["left", "center", "right"].map(async (align) =>
      bitmapStats(await rasterizeThaiOperations([
        { type: "text", value: "ทดสอบ", align: align as "left" | "center" | "right" },
      ], profile)),
    ));

    expect(left.minX).toBeLessThan(40);
    expect(center.minX).toBeGreaterThan(left.minX + 150);
    expect(right.maxX).toBeGreaterThan(530);
  });

  it("uses the bundled bold face and a larger block for large text", async () => {
    const profile = createDirectPrinterProfile(576);
    const normal = bitmapStats(await rasterizeThaiOperations([
      { type: "text", value: "ขอบคุณที่ใช้บริการ" },
    ], profile));
    const bold = bitmapStats(await rasterizeThaiOperations([
      { type: "text", value: "ขอบคุณที่ใช้บริการ", style: "bold" },
    ], profile));
    const large = bitmapStats(await rasterizeThaiOperations([
      { type: "text", value: "ขอบคุณที่ใช้บริการ", style: "large" },
    ], profile));

    expect(bold.blackPixels).toBeGreaterThan(normal.blackPixels);
    expect(large.rows).toBeGreaterThan(normal.rows);
  });

  it("wraps long Thai into bounded raster bands instead of one receipt-sized image", async () => {
    const profile = createDirectPrinterProfile(576);
    const operations = await rasterizeThaiOperations([
      { type: "text", value: "ข้าวผัดกุ้งเพิ่มไข่ดาว ".repeat(12) },
    ], profile);
    const stats = bitmapStats(operations);

    expect(operations.length).toBeGreaterThan(2);
    expect(stats.rows).toBeGreaterThan(128);
    expect(operations.every((operation) =>
      operation.type !== "raster"
      || operation.bytes.length / Math.ceil(operation.widthDots / 8) <= 64,
    )).toBe(true);
    for (const operation of operations) {
      if (operation.type !== "raster") continue;
      const encoded = encodeEscpos([operation], profile);
      const height = operation.bytes.byteLength / 72;
      expect(Array.from(encoded.slice(0, 8))).toEqual([
        0x1d, 0x76, 0x30, 0x00,
        72, 0,
        height & 0xff, (height >> 8) & 0xff,
      ]);
      expect(encoded.byteLength).toBe(8 + 72 * height);
      expect(encoded.slice(8)).toEqual(operation.bytes);
    }
  });

  it("anchors semantic receipt columns at both edges", async () => {
    const profile = createDirectPrinterProfile(576);
    const operations = await rasterizeThaiOperations([{
      type: "text",
      value: "ยอดรวม                                    105.00",
      style: "bold",
      columns: { left: "ยอดรวม", right: "105.00" },
    }], profile);
    const stats = bitmapStats(operations);

    expect(stats.minX).toBeLessThan(40);
    expect(stats.maxX).toBeGreaterThan(520);
  });

  it("rasterizes four-column receipt rows and wraps only the item column", async () => {
    const profile = createDirectPrinterProfile(576);
    const operations = await rasterizeThaiOperations([{
      type: "text",
      value: "ซัก-พับ กระโปรงยาวมาก 20.00 x4 80.00",
      tableColumns: {
        item: "ซัก-พับ กระโปรงยาวมากเป็นพิเศษ / ผ้าบาง",
        unitPrice: "20.00",
        quantity: "x4",
        total: "80.00",
      },
    }], profile);
    const stats = bitmapStats(operations);

    expect(operations.every((operation) => operation.type === "raster")).toBe(true);
    expect(stats.rows).toBeGreaterThan(45);
    expect(stats.minX).toBeLessThan(40);
    expect(stats.maxX).toBeGreaterThan(540);
  });

  it("preserves non-text ESC/POS operations while rasterizing Thai", async () => {
    const profile = createDirectPrinterProfile(576);
    const controls = [
      { type: "nativeQr", data: "000201", size: 6 },
      { type: "nativeBarcode", symbology: "CODE39", data: "RC-0003" },
      { type: "feed", lines: 3 },
      { type: "partialCut" },
      { type: "drawerPulse", pin: 2, onMs: 40, offMs: 40 },
      { type: "buzzer", pattern: "SHORT" },
    ] as const;
    const operations = await rasterizeThaiOperations([
      { type: "text", value: "ใบเสร็จ RC-0003" },
      ...controls,
    ], profile);

    expect(operations.filter((operation) => operation.type !== "raster")).toEqual(controls);
  });
});
