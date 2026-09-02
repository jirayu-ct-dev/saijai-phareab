import { describe, expect, it } from "vitest";
import type { PrintOperation, PrinterProfile } from "../../shared/types/printing";
import { createPrinterCapabilities } from "../../shared/utils/printJobState";
import {
  PrintEncodeError,
  columnsForProfile,
  displayWidth,
  encodeEscpos,
  encodeTis620,
  splitRasterBands,
  wrapText,
} from "../../shared/utils/escpos";
import { composePrintOperations } from "../../shared/utils/printComposer";

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

const hex = (value: Uint8Array): string =>
  Array.from(value).map((byte) => byte.toString(16).padStart(2, "0")).join(" ");

describe("escpos: TIS-620 mapping", () => {
  it("maps the Thai block onto the TIS-620 slots (codepoint + 0xA0)", () => {
    // KO KAI U+0E01 -> 0xA1
    expect(Array.from(encodeTis620("ก"))).toEqual([0xa1]);
    // THAI DIGIT NINE U+0E59 -> 0xF9
    expect(Array.from(encodeTis620("๙"))).toEqual([0xf9]);
    // SARA AM U+0E33 -> 0xD3; BAHT U+0E3F -> 0xDF
    expect(Array.from(encodeTis620("ำ฿"))).toEqual([0xd3, 0xdf]);
    // Combining marks: MAI EK U+0E48 -> 0xE8, PHINTHU U+0E3A -> 0xDA
    expect(Array.from(encodeTis620("ฺ่"))).toEqual([0xe8, 0xda]);
  });

  it("keeps ASCII and LF, drops CR and non-Thai combining marks, falls back to '?'", () => {
    expect(Array.from(encodeTis620("A b1"))).toEqual([0x41, 0x20, 0x62, 0x31]);
    expect(Array.from(encodeTis620("a\nb"))).toEqual([0x61, 0x0a, 0x62]);
    expect(Array.from(encodeTis620("a\rb"))).toEqual([0x61, 0x62]); // CR dropped
    // Latin combining acute U+0301 has no TIS-620 slot: dropped, not '?'.
    expect(Array.from(encodeTis620("a\u0301b"))).toEqual([0x61, 0x62]);
    // Emoji and other scripts fall back to '?' (0x3F).
    expect(Array.from(encodeTis620("😀"))).toEqual([0x3f]);
    expect(Array.from(encodeTis620("中"))).toEqual([0x3f]);
  });

  it("never splits surrogate pairs mid-codepoint", () => {
    // One 4-byte emoji is ONE code point -> exactly one '?'.
    expect(encodeTis620("😀ก")).toHaveLength(2);
    expect(Array.from(encodeTis620("😀ก"))).toEqual([0x3f, 0xa1]);
  });
});

describe("escpos: Thai layout", () => {
  it("counts Thai combining marks as zero-width columns", () => {
    expect(displayWidth("hello")).toBe(5);
    expect(displayWidth("ก")).toBe(1);
    // ก + mai ek is ONE print column.
    expect(displayWidth("ก่")).toBe(1);
    // Base + tone mark + vowel-above still one column.
    expect(displayWidth("ก้็")).toBe(1);
    expect(displayWidth("ไทย 95.50")).toBe(9);
  });

  it("wraps long text at the profile column count (48 columns on 576 dots)", () => {
    expect(columnsForProfile(sampleProfile())).toBe(48);
    expect(columnsForProfile(sampleProfile({ printableDots: 384 }))).toBe(32);

    const longWord = "ก".repeat(60);
    const lines = wrapText(longWord, 48);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveLength(48);
    expect(lines[1]).toHaveLength(12);
  });

  it("wraps Thai text without counting combining marks and never orphans a mark", () => {
    // 40 base chars + 10 combining marks = 40 columns, one line on 48 columns.
    const word = "ก" + "้".repeat(9) + "ง".repeat(39); // 40 bases, 9 marks
    expect(displayWidth(word)).toBe(40);
    expect(wrapText(word, 48)).toHaveLength(1);

    // A base at the exact column limit keeps its trailing tone mark.
    const base = "ก".repeat(48) + "ุ";
    const lines = wrapText(base + "ข", 48);
    expect(lines[0]).toBe(base);
    expect(lines[1]).toBe("ข");
  });

  it("breaks at spaces when possible and keeps cells atomic", () => {
    expect(wrapText("hello thai world", 11)).toEqual(["hello thai", "world"]);
    const lines = wrapText("abcdefghij klmnopqrst", 5);
    expect(lines[0]).toBe("abcde");
    expect(lines[1]).toBe("fghij");
    expect(lines[2]).toBe("klmno");
    expect(lines[3]).toBe("pqrst");
  });
});

describe("escpos: byte-level encoding", () => {
  it("encodes initialize as ESC @ followed by the Thai codepage ESC t 0x16", () => {
    const stream = encodeEscpos([{ type: "initialize" }], sampleProfile());
    expect(hex(stream)).toBe("1b 40 1b 74 16");
  });

  it("encodes partialCut as GS V 66 0", () => {
    const stream = encodeEscpos([{ type: "partialCut" }], sampleProfile());
    expect(hex(stream)).toBe("1d 56 42 00");
  });

  it("encodes feed as ESC d n", () => {
    const stream = encodeEscpos([{ type: "feed", lines: 4 }], sampleProfile());
    expect(hex(stream)).toBe("1b 64 04");
  });

  it("encodes drawerPulse as ESC p m t1 t2 with 2ms units", () => {
    const stream = encodeEscpos(
      [{ type: "drawerPulse", pin: 2, onMs: 40, offMs: 40 }],
      sampleProfile(),
    );
    expect(hex(stream)).toBe("1b 70 00 14 14");
    const pin5 = encodeEscpos([{ type: "drawerPulse", pin: 5, onMs: 80, offMs: 60 }], sampleProfile());
    expect(hex(pin5)).toBe("1b 70 01 28 1e");
    expect(() => encodeEscpos([{ type: "drawerPulse", pin: 3, onMs: 40, offMs: 40 }], sampleProfile()))
      .toThrow(PrintEncodeError);
  });

  it("encodes the standard native QR sequence (model 2, EC M, store, print)", () => {
    const stream = encodeEscpos([{ type: "nativeQr", data: "TEST", size: 6 }], sampleProfile());
    const bytes = Array.from(stream);
    // Starts with model selection: 1D 28 6B 04 00 31 41 32 00
    expect(bytes.slice(0, 9)).toEqual([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]);
    // Contains the store-data header: 1D 28 6B pL pH 31 50 30
    const store = bytes.findIndex(
      (_, index) =>
        bytes[index] === 0x1d && bytes[index + 5] === 0x31 && bytes[index + 6] === 0x50,
    );
    expect(store).toBeGreaterThan(0);
    expect(bytes[store + 3]).toBe("TEST".length + 3); // pL = data + cn + fn + m
    expect(bytes[store + 4]).toBe(0x00);
    expect(bytes[store + 7]).toBe(0x30);
    expect(bytes.slice(store + 8, store + 12)).toEqual(
      Array.from(encodeTis620("TEST")),
    );
    // Ends with the print command: 1D 28 6B 03 00 31 51 30
    expect(bytes.slice(-8)).toEqual([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]);
  });

  it("wraps raster data with the GS v 0 header (xL xH yL yH)", () => {
    // One row of 8 dots: 1 byte/row, 0xFF = 8 black dots.
    const stream = encodeEscpos(
      [{ type: "raster", bytes: new Uint8Array([0xff]), widthDots: 8 }],
      sampleProfile(),
    );
    expect(hex(stream)).toBe("1d 76 30 00 08 00 01 00 ff");
  });

  it("rejects raster wider than the printable area and malformed row packing", () => {
    expect(() =>
      encodeEscpos([{ type: "raster", bytes: new Uint8Array(64), widthDots: 600 }], sampleProfile()),
    ).toThrow(PrintEncodeError);
    // Width 16 -> 2 bytes per row; 7 bytes is not a whole number of rows.
    expect(() =>
      encodeEscpos([{ type: "raster", bytes: new Uint8Array(7), widthDots: 16 }], sampleProfile()),
    ).toThrow(PrintEncodeError);
    try {
      encodeEscpos([{ type: "raster", bytes: new Uint8Array(64), widthDots: 600 }], sampleProfile());
    } catch (error) {
      expect(error).toBeInstanceOf(PrintEncodeError);
      expect((error as PrintEncodeError).operation).toBe("raster");
      expect((error as PrintEncodeError).reason).toContain("576");
    }
  });

  it("splits raster bands on exact row boundaries", () => {
    const bands = splitRasterBands(new Uint8Array(120 * 12), 96, 64);
    expect(bands).toHaveLength(2);
    expect(bands[0]).toHaveLength(64 * 12);
    expect(bands[1]).toHaveLength(56 * 12);
  });

  it("encodes barcodes via GS k and rejects unknown symbologies", () => {
    const code39 = encodeEscpos(
      [{ type: "nativeBarcode", symbology: "CODE39", data: "ABC-123" }],
      sampleProfile(),
    );
    const bytes = Array.from(code39);
    expect(bytes[0]).toBe(0x1d);
    expect(bytes[1]).toBe(0x6b);
    expect(bytes[2]).toBe(65); // function B CODE39
    expect(bytes[3]).toBe(7); // data length
    expect(bytes.slice(4)).toEqual(Array.from(encodeTis620("ABC-123")));

    expect(() =>
      encodeEscpos(
        [{ type: "nativeBarcode", symbology: "PDF417", data: "x" }],
        sampleProfile(),
      ),
    ).toThrow(PrintEncodeError);
    expect(() =>
      encodeEscpos(
        [{ type: "nativeBarcode", symbology: "CODE39", data: "lowercase!" }],
        sampleProfile(),
      ),
    ).toThrow(PrintEncodeError);
  });

  it("maps nvLogo keys to slots 48..122 and rejects invalid keys", () => {
    const stream = encodeEscpos([{ type: "nvLogo", key: "48" }], sampleProfile());
    expect(hex(stream)).toBe("1d 28 4c 06 00 30 45 30 00");
    expect(() => encodeEscpos([{ type: "nvLogo", key: "47" }], sampleProfile()))
      .toThrow(PrintEncodeError);
    expect(() => encodeEscpos([{ type: "nvLogo", key: "123" }], sampleProfile()))
      .toThrow(PrintEncodeError);
    expect(() => encodeEscpos([{ type: "nvLogo", key: "logo-main" }], sampleProfile()))
      .toThrow(PrintEncodeError);
  });

  it("encodes text with style, alignment and Thai codepage bytes", () => {
    const stream = encodeEscpos(
      [{ type: "text", value: "ก", style: "large", align: "center" }],
      sampleProfile(),
    );
    expect(hex(stream)).toBe(
      "1b 61 01 " // ESC a 1 (center)
      + "1b 21 30 " // ESC ! 0x30 (double width + height)
      + "a1 " // ก
      + "0a " // LF
      + "1b 21 00 " // reset style
      + "1b 61 00", // reset align
    );
  });

  it("wraps long text into multiple LF-terminated TIS-620 lines", () => {
    const stream = encodeEscpos(
      [{ type: "text", value: "A".repeat(60) }],
      sampleProfile(),
    );
    const bytes = Array.from(stream);
    const lfs = bytes.filter((byte) => byte === 0x0a);
    expect(lfs).toHaveLength(2); // 48 columns -> 48 + 12
    expect(bytes.filter((byte) => byte === 0x41)).toHaveLength(60);
  });

  it("encodes a full composed document stream: initialize first, partial cut last", () => {
    // Round-trip through the composer to lock the ordering contract.
    const document = {
      kind: "QUOTATION",
      documentId: "p1",
      documentNo: "QT-1",
      revision: 1,
      issuedAt: "2026-09-03T00:00:00.000Z",
      shop: { name: "ร้าน", addressLine: null, phoneNumber: null, taxId: null },
      customer: { name: "ลูกค้า", phoneNumber: null },
      items: [],
      totals: { subtotalAmountMinor: 0, discountAmountMinor: 0, totalAmountMinor: 0 },
      note: null,
      qrBlocks: [],
    } as const;
    const { operations } = composePrintOperations(document, sampleProfile());
    const stream = encodeEscpos(operations, sampleProfile());
    const bytes = Array.from(stream);
    expect(bytes.slice(0, 5)).toEqual([0x1b, 0x40, 0x1b, 0x74, 0x16]); // ESC @ + ESC t 16
    expect(bytes.slice(-4)).toEqual([0x1d, 0x56, 0x42, 0x00]); // GS V 66 0
  });

  it("throws a typed PrintEncodeError for unknown operation types", () => {
    const bogus = { type: "teleport" } as unknown as PrintOperation;
    try {
      encodeEscpos([bogus], sampleProfile());
      expect.unreachable("expected PrintEncodeError");
    } catch (error) {
      expect(error).toBeInstanceOf(PrintEncodeError);
      expect((error as PrintEncodeError).operation).toBe("teleport");
    }
  });
});
