// ============================
// ESC/POS ENCODER (pure)
// ============================
//
// PRN-05 "Hybrid renderer": encodes PrintOperation[] into a single ESC/POS
// byte stream for the XP-C260M (and compatible ESC/POS thermal printers).
//
// Pure TypeScript: no Node APIs, no DOM/canvas, no dependencies. Runs in any
// JS runtime (server, bridge, worker). Money is never re-derived here (C10):
// text amounts already arrive as display strings composed from integer minor
// units.
//
// Command notes verified against common ESC/POS / Xprinter firmware; anything
// firmware-specific is flagged in a comment and must be confirmed on the
// physical unit (see the project xprinter skill's saijai-operations reference).

import type {
  PrintOperation,
  PrinterProfile,
  ThaiPrintStrategy,
} from "../types/printing";

// ============================
// TYPED ERROR
// ============================

/**
 * Thrown for any operation that cannot be encoded. Never silently dropped:
 * the bridge surfaces this as FAILED_RENDER with a safe message.
 */
export class PrintEncodeError extends Error {
  readonly operation: string;
  readonly reason: string;

  constructor(operation: string, reason: string) {
    super(`ESC/POS encode failed for operation "${operation}": ${reason}`);
    this.name = "PrintEncodeError";
    this.operation = operation;
    this.reason = reason;
  }
}

// ============================
// BYTE HELPERS
// ============================

export function concatBytes(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);

// ============================
// THAI TEXT: WINDOWS-874 / PC874 MAPPING
// ============================
//
// Mapping policy (exact):
// - U+0E01..U+0E3A  -> byte + 0xA0 (0xA1..0xDA). All Thai combining marks
//   (U+0E31, U+0E34..U+0E3A, U+0E47..U+0E4E) live in these ranges and DO have
//   CP874 slots, so they encode fine; they only need zero-width layout
//   treatment (see displayWidth).
// - U+0E3F..U+0E5B  -> byte + 0xA0 (0xDF..0xFB), includes BAHT U+0E3F -> 0xDF.
// - U+0E3B..U+0E3E  -> unassigned in both Unicode and CP874 -> '?'.
// - 0x20..0x7E ASCII and LF (0x0A) map to themselves; CR (0x0D) is dropped.
// - Windows punctuation uses the defined CP874 extension bytes.
// - Non-Thai combining marks (U+0300..U+036F diacritical range) are DROPPED:
//   they have no CP874 slot and would render as '?' garbage next to Thai.
// - Everything else (symbols, emoji, other scripts) -> '?' (0x3F).
// The result is a single-byte stream printed in the printer's Thai codepage.

const THAI_RANGE_1_START = 0x0e01;
const THAI_RANGE_1_END = 0x0e3a;
const THAI_RANGE_2_START = 0x0e3f;
const THAI_RANGE_2_END = 0x0e5b;
const LATIN_COMBINING_START = 0x0300;
const LATIN_COMBINING_END = 0x036f;

const CP874_EXTENSIONS = new Map<number, number>([
  [0x20ac, 0x80], // EURO SIGN
  [0x2026, 0x85], // HORIZONTAL ELLIPSIS
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x00a0, 0xa0],
]);

export function encodeCp874Char(codePoint: number): number | null {
  if (codePoint === 0x0a) return 0x0a;
  if (codePoint === 0x0d) return null;
  if (codePoint >= 0x20 && codePoint <= 0x7e) return codePoint;
  const extension = CP874_EXTENSIONS.get(codePoint);
  if (extension !== undefined) return extension;
  if (
    (codePoint >= THAI_RANGE_1_START && codePoint <= THAI_RANGE_1_END)
    || (codePoint >= THAI_RANGE_2_START && codePoint <= THAI_RANGE_2_END)
  ) {
    // +0xA0 maps both ranges exactly (0xDB..0xDE of CP874 are unused).
    return codePoint + 0xa0;
  }
  if (codePoint >= LATIN_COMBINING_START && codePoint <= LATIN_COMBINING_END) {
    return null; // drop: no CP874 slot, would corrupt Thai output
  }
  return 0x3f; // '?' fallback
}

/** Backward-compatible alias for callers using the former subset name. */
export const encodeTis620Char = encodeCp874Char;

export function encodeCp874(text: string): Uint8Array {
  const out: number[] = [];
  // Array.from iterates code points, so surrogate pairs never split.
  for (const char of text) {
    const mapped = encodeCp874Char(char.codePointAt(0) ?? 0x3f);
    if (mapped !== null) out.push(mapped);
  }
  return Uint8Array.from(out);
}

/** Backward-compatible alias; CP874 preserves the same Thai byte positions. */
export const encodeTis620 = encodeCp874;

// ============================
// THAI LAYOUT: ZERO-WIDTH COMBINING MARKS AND WRAPPING
// ============================
//
// Thai combining marks render above/below the base character and occupy no
// print column. They MUST NOT be counted toward line width, and they MUST
// never be separated from their base character by a line break.

const THAI_COMBINING = new Set<number>([0x0e31, ...range(0x0e34, 0x0e3a), ...range(0x0e47, 0x0e4e)]);

function range(start: number, end: number): number[] {
  const values: number[] = [];
  for (let value = start; value <= end; value += 1) values.push(value);
  return values;
}

export function isThaiCombiningMark(codePoint: number): boolean {
  return THAI_COMBINING.has(codePoint);
}

/**
 * Display width in print columns. Thai combining marks count 0; every other
 * code point counts 1 (font A is single-width; wide CJK is out of scope for
 * this printer's Thai receipts).
 */
export function displayWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    if (!isThaiCombiningMark(char.codePointAt(0) ?? 0)) width += 1;
  }
  return width;
}

/**
 * Splits text into lines of at most `columns` display columns.
 * - Iterates code points (surrogate pairs never split mid-codepoint).
 * - A "cell" is one base character plus its trailing Thai combining marks;
 *   cells are atomic, so marks always stay attached to their base.
 * - Leading spaces of wrapped lines are dropped and a break never leaves a
 *   trailing space at end of line.
 */
export function wrapText(text: string, columns: number): string[] {
  if (columns < 1) throw new Error("wrapText requires columns >= 1");
  const lines: string[] = [];
  let current = "";
  let width = 0;

  const flush = () => {
    // A break never leaves a trailing space at end of line.
    const trimmed = current.replace(/ +$/, "");
    if (trimmed.length > 0) lines.push(trimmed);
    current = "";
    width = 0;
  };

  const chars = Array.from(text);
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index]!;
    const codePoint = char.codePointAt(0) ?? 0;
    if (char === "\r") continue;
    if (char === "\n") {
      // Explicit document line breaks are semantic. Preserve even blank lines
      // so raster rendering never merges or silently drops multi-line notes.
      lines.push(current.replace(/ +$/, ""));
      current = "";
      width = 0;
      continue;
    }
    if (isThaiCombiningMark(codePoint)) {
      // Zero-width: always attaches to whatever base precedes it, even if the
      // line is already at full column count.
      current += char;
      continue;
    }
    if (char === " " && width > 0) {
      // Opportunistic break point: peek ahead past consecutive spaces; if the
      // remaining cell does not fit, flush here and skip the spaces.
      let nextIndex = index;
      while (chars[nextIndex] === " ") nextIndex += 1;
      const remaining = chars[nextIndex];
      const remainingWidth = remaining === undefined
        ? 0
        : isThaiCombiningMark(remaining.codePointAt(0) ?? 0) ? 0 : 1;
      if (remainingWidth > 0 && width + 1 > columns) {
        flush();
        index = nextIndex - 1; // loop header increments; resume at next cell
        continue;
      }
      current += char;
      width += 1;
      continue;
    }
    if (width + 1 > columns) {
      flush();
    }
    current += char;
    width += 1;
  }
  flush();
  return lines.length > 0 ? lines : [""];
}

// ============================
// PROFILE HELPERS
// ============================
//
// Font A on 203 dpi thermal heads is 12 dots wide per column. 576 dots -> 48
// columns (chosen as the 80 mm standard per plan; 42 would be the 9x9 font).
// 512 -> 42 columns, 384 -> 32 columns.

const DOTS_PER_COLUMN = 12;

export function columnsForProfile(profile: PrinterProfile): number {
  return Math.floor(profile.printableDots / DOTS_PER_COLUMN);
}

const ESC = 0x1b;
const GS = 0x1d;

const STYLE_BYTES: Record<string, number> = {
  normal: 0x00,
  bold: 0x08, // ESC ! bit 3: emphasized
  large: 0x30, // ESC ! bits 4+5: double height + double width
};

const ALIGN_BYTES: Record<string, number> = {
  left: 0x00,
  center: 0x01,
  right: 0x02,
};

// ============================
// RASTER BAND SPLITTING
// ============================
//
// Raster input contract (documented, shared by composer and encoder):
// `bytes` are raw 1-bit-per-pixel rows, MSB-first per byte (1 = black),
// packed to whole bytes per row (bytesPerRow = ceil(widthDots / 8)), top row
// first. The encoder only wraps them with the GS v 0 header.

export function bytesPerRow(widthDots: number): number {
  return Math.ceil(widthDots / 8);
}

/**
 * Splits a tall bitmap into horizontal bands of at most `bandHeightDots`
 * rows each (PRN-05 band splitting; default band height 64 dots). Returns one
 * byte array per band; the last band may be shorter.
 */
export function splitRasterBands(
  rawBytes: Uint8Array,
  widthDots: number,
  bandHeightDots: number,
): Uint8Array[] {
  const rowBytes = bytesPerRow(widthDots);
  if (rowBytes < 1) throw new Error("widthDots must be >= 1");
  if (rawBytes.length % rowBytes !== 0) {
    throw new Error("raster byte length must be a whole number of rows");
  }
  if (bandHeightDots < 1) throw new Error("bandHeightDots must be >= 1");
  const rows = rawBytes.length / rowBytes;
  const bands: Uint8Array[] = [];
  for (let startRow = 0; startRow < rows; startRow += bandHeightDots) {
    const bandRows = Math.min(bandHeightDots, rows - startRow);
    bands.push(rawBytes.slice(startRow * rowBytes, (startRow + bandRows) * rowBytes));
  }
  return bands;
}

// ============================
// OPERATION ENCODERS
// ============================

function encodeTextOperation(
  operation: Extract<PrintOperation, { type: "text" }>,
  profile: PrinterProfile,
  thaiStrategy: ThaiPrintStrategy,
): Uint8Array {
  const columns = columnsForProfile(profile);
  const style = operation.style ?? "normal";
  const align = operation.align ?? "left";
  const styleByte = STYLE_BYTES[style];
  const alignByte = ALIGN_BYTES[align];
  if (styleByte === undefined) {
    throw new PrintEncodeError("text", `unknown style "${style}"`);
  }
  if (alignByte === undefined) {
    throw new PrintEncodeError("text", `unknown align "${align}"`);
  }
  const parts: Uint8Array[] = [bytes(ESC, 0x61, alignByte), bytes(ESC, 0x21, styleByte)];
  const lines = wrapText(operation.value, columns);
  for (const line of lines) {
    if (/[฀-๿]/u.test(line)) {
      if (thaiStrategy === "raster-thai") {
        throw new PrintEncodeError("text", "Thai text must be rasterized before ESC/POS encoding");
      }
      // Select the unit's physically reported Thai page immediately before
      // every native Thai line. Page 70 (0x46) is the default; page 255 is an
      // explicit test-only fallback until confirmed on the actual printer.
      parts.push(bytes(ESC, 0x74, thaiStrategy === "native-thai-255" ? 0xff : 0x46));
    }
    parts.push(encodeCp874(line));
    parts.push(bytes(0x0a)); // LF
  }
  parts.push(bytes(ESC, 0x21, 0x00)); // reset style
  if (alignByte !== 0x00) parts.push(bytes(ESC, 0x61, 0x00)); // reset align
  return concatBytes(parts);
}

function encodeRasterOperation(
  operation: Extract<PrintOperation, { type: "raster" }>,
  profile: PrinterProfile,
): Uint8Array {
  const { bytes: rawBytes, widthDots } = operation;
  if (widthDots < 1 || widthDots > profile.printableDots) {
    throw new PrintEncodeError(
      "raster",
      `widthDots ${widthDots} exceeds printable width ${profile.printableDots}`,
    );
  }
  const rowBytes = bytesPerRow(widthDots);
  if (rawBytes.length === 0 || rawBytes.length % rowBytes !== 0) {
    throw new PrintEncodeError(
      "raster",
      `byte length ${rawBytes.length} is not a whole number of ${rowBytes}-byte rows for width ${widthDots}`,
    );
  }
  const heightDots = rawBytes.length / rowBytes;
  if (heightDots > 0xffff) {
    throw new PrintEncodeError("raster", `height ${heightDots} exceeds 65535 dots`);
  }
  // GS v 0: 1D 76 30 00 xL xH yL yH <data>
  // xL/xH is the number of BYTES in one raster row, not the number of dots.
  // Using widthDots here makes a 576-dot printer expect 576 bytes per row
  // instead of 72, so it consumes following commands as image payload.
  return concatBytes([
    bytes(GS, 0x76, 0x30, 0x00, rowBytes & 0xff, (rowBytes >> 8) & 0xff, heightDots & 0xff, (heightDots >> 8) & 0xff),
    rawBytes,
  ]);
}

function encodeNativeQrOperation(
  operation: Extract<PrintOperation, { type: "nativeQr" }>,
): Uint8Array {
  const data = encodeCp874(operation.data);
  if (data.length === 0) {
    throw new PrintEncodeError("nativeQr", "QR payload must not be empty");
  }
  const size = Math.trunc(operation.size);
  if (size < 1 || size > 16) {
    throw new PrintEncodeError("nativeQr", `module size ${operation.size} outside 1..16`);
  }
  // Standard ESC/POS QR sequence (model 2, error correction M):
  //   fn 65 select model 2, fn 67 module size, fn 69 EC level,
  //   fn 80 store data, fn 81 print.
  // pL+pH counts the bytes after pH: cn (0x31) + fn (0x50) + m (0x30) + data.
  const dataLength = data.length + 3;
  const store: Uint8Array = concatBytes([
    bytes(GS, 0x28, 0x6b, (dataLength & 0xff), (dataLength >> 8) & 0xff, 0x31, 0x50, 0x30),
    data,
  ]);
  return concatBytes([
    // 1D 28 6B 04 00 31 41 32 00 : model 2
    bytes(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00),
    // 1D 28 6B 03 00 31 43 n : module size
    bytes(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size),
    // 1D 28 6B 03 00 31 45 31 : error correction M (0x31)
    bytes(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31),
    store,
    // 1D 28 6B 03 00 31 51 30 : print
    bytes(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30),
  ]);
}

const BARCODE_SYMBOLOGIES: Record<string, number> = {
  // Function B (GS k m n d1..dn). Values are the common Epson/XP assignment;
  // verify on the physical unit.
  CODE39: 65,
  ITF: 66,
  CODE128: 73,
};

const CODE39_CHARSET = /^[0-9A-Z\-. $/+%]+$/;

function encodeNativeBarcodeOperation(
  operation: Extract<PrintOperation, { type: "nativeBarcode" }>,
): Uint8Array {
  const symbology = BARCODE_SYMBOLOGIES[operation.symbology];
  if (symbology === undefined) {
    throw new PrintEncodeError(
      "nativeBarcode",
      `unsupported symbology "${operation.symbology}" (supported: ${Object.keys(BARCODE_SYMBOLOGIES).join(", ")})`,
    );
  }
  const data = encodeCp874(operation.data);
  if (data.length === 0 || data.length > 255) {
    throw new PrintEncodeError("nativeBarcode", "barcode data must be 1..255 bytes");
  }
  if (operation.symbology === "CODE39" && !CODE39_CHARSET.test(operation.data)) {
    throw new PrintEncodeError("nativeBarcode", "CODE39 data outside the CODE39 charset");
  }
  // GS k m n d1..dn (function B)
  return concatBytes([bytes(GS, 0x6b, symbology, data.length), data]);
}

const NV_LOGO_SLOT_MIN = 48;
const NV_LOGO_SLOT_MAX = 122;

function encodeNvLogoOperation(operation: Extract<PrintOperation, { type: "nvLogo" }>): Uint8Array {
  const key = operation.key;
  if (!/^\d{2,3}$/.test(key)) {
    throw new PrintEncodeError("nvLogo", `key "${key}" must be a decimal slot number ${NV_LOGO_SLOT_MIN}..${NV_LOGO_SLOT_MAX}`);
  }
  const slot = Number.parseInt(key, 10);
  if (slot < NV_LOGO_SLOT_MIN || slot > NV_LOGO_SLOT_MAX) {
    throw new PrintEncodeError("nvLogo", `slot ${slot} outside NV keyword range ${NV_LOGO_SLOT_MIN}..${NV_LOGO_SLOT_MAX}`);
  }
  // GS ( L print NV logo (function 67, m=0x30 fn=0x45, slot little-endian
  // kc1 + kc2*256). The 06 00 length field follows the widely-used firmware
  // convention but must be verified on the physical unit (HW-01).
  return bytes(GS, 0x28, 0x4c, 0x06, 0x00, 0x30, 0x45, slot & 0xff, (slot >> 8) & 0xff);
}

const BUZZER_PATTERNS: Record<string, [number, number]> = {
  SHORT: [1, 1],
  LONG: [3, 3],
  DOUBLE: [2, 2],
};

function encodeBuzzerOperation(operation: Extract<PrintOperation, { type: "buzzer" }>): Uint8Array {
  const pattern = BUZZER_PATTERNS[operation.pattern];
  if (pattern === undefined) {
    throw new PrintEncodeError(
      "buzzer",
      `unknown pattern "${operation.pattern}" (supported: ${Object.keys(BUZZER_PATTERNS).join(", ")})`,
    );
  }
  // ESC B n1 n2 is the simple XP-flavored buzzer form; buzzer commands vary
  // heavily between firmwares (ESC ( A, DLE DC4 fn 7...). Verify on hardware
  // before enabling the buzzer capability in any profile.
  return bytes(ESC, 0x42, pattern[0], pattern[1]);
}

function encodeDrawerPulseOperation(
  operation: Extract<PrintOperation, { type: "drawerPulse" }>,
): Uint8Array {
  const pinMap: Record<number, number> = { 2: 0x00, 5: 0x01 };
  const pin = pinMap[operation.pin];
  if (pin === undefined) {
    throw new PrintEncodeError("drawerPulse", `pin ${operation.pin} must be 2 or 5`);
  }
  // ESC p m t1 t2: t1/t2 are on/off times in 2 ms units.
  const t1 = clamp2msUnits(operation.onMs);
  const t2 = clamp2msUnits(operation.offMs);
  return bytes(ESC, 0x70, pin, t1, t2);
}

function clamp2msUnits(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 1;
  return Math.min(255, Math.max(1, Math.round(ms / 2)));
}

// ============================
// STREAM ENCODER
// ============================

/**
 * Encodes operations into one concatenated ESC/POS byte stream (no chunking).
 * Each operation is encoded independently; anything unencodable throws a
 * PrintEncodeError naming the operation — nothing is silently dropped.
 */
export type EncodeEscposOptions = {
  thaiStrategy?: ThaiPrintStrategy;
};

export function encodeEscpos(
  operations: PrintOperation[],
  profile: PrinterProfile,
  options: EncodeEscposOptions = {},
): Uint8Array {
  const thaiStrategy = options.thaiStrategy ?? "raster-thai";
  const parts: Uint8Array[] = [];
  for (const operation of operations) {
    switch (operation.type) {
      case "initialize":
        // Raster mode leaves the printer on its default ASCII page. Native
        // Thai pages are selected only for an explicit diagnostic strategy.
        parts.push(bytes(ESC, 0x40));
        if (thaiStrategy !== "raster-thai") {
          parts.push(bytes(ESC, 0x74, thaiStrategy === "native-thai-255" ? 0xff : 0x46));
        }
        break;
      case "text":
        parts.push(encodeTextOperation(operation, profile, thaiStrategy));
        break;
      case "raster":
        parts.push(encodeRasterOperation(operation, profile));
        break;
      case "nativeQr":
        parts.push(encodeNativeQrOperation(operation));
        break;
      case "nativeBarcode":
        parts.push(encodeNativeBarcodeOperation(operation));
        break;
      case "nvLogo":
        parts.push(encodeNvLogoOperation(operation));
        break;
      case "feed":
        // ESC d n: print and feed n lines.
        if (!Number.isInteger(operation.lines) || operation.lines < 1 || operation.lines > 255) {
          throw new PrintEncodeError("feed", `lines ${operation.lines} must be an integer 1..255`);
        }
        parts.push(bytes(ESC, 0x64, operation.lines));
        break;
      case "partialCut":
        // GS V 66 0: partial cut (feed one line + cut).
        parts.push(bytes(GS, 0x56, 0x42, 0x00));
        break;
      case "buzzer":
        parts.push(encodeBuzzerOperation(operation));
        break;
      case "drawerPulse":
        parts.push(encodeDrawerPulseOperation(operation));
        break;
      default: {
        const unknown = operation as { type?: string };
        throw new PrintEncodeError(String(unknown?.type ?? "unknown"), "unknown operation type");
      }
    }
  }
  return concatBytes(parts);
}
