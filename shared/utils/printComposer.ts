// ============================
// PRINT COMPOSER (pure)
// ============================
//
// PRN-05 "Hybrid renderer": composes a canonical PrintDocument + PrinterProfile
// into an ordered PrintOperation[] plus a JSON-safe compose report.
//
// Constraints honored:
// - C10 (money boundary): money is never re-derived here. Amounts arrive as
//   integer minor units and are only DISPLAY-formatted via formatMinor()
//   (integer math, no floats). QR payloads are copied verbatim from the
//   document; the composer never builds or mutates a QR payload.
// - HYBRID vs RASTER: text is always emitted as native ESC/POS text
//   operations (encoded by shared/utils/escpos.ts). Shaped-raster rendering
//   of Thai text for RASTER-mode profiles is a bridge-side concern supplied
//   through `bitmapFor`; the composer itself never rasterizes text.
// - Native QR and raster fallback encode the SAME payload string: the exact
//   `block.payload` is passed to both the nativeQr operation and the bitmap
//   provider (plan acceptance criterion 19).
// - LINE QR blocks carry an imageUrl; fetching/resolving that image is the
//   server's/bridge's job (the composer only routes the payload through the
//   bitmap provider).
// - A skipped QR block never fails the receipt; it is recorded in the report.

import type {
  PrintDocument,
  PrintOperation,
  PrintQrBlock,
  PrinterProfile,
} from "../types/printing";
import { columnsForProfile, displayWidth, splitRasterBands } from "./escpos";

// ============================
// PUBLIC TYPES
// ============================

/** Which semantic QR block a bitmap is requested for. */
export type PrintQrBitmapTarget = "PAYMENT_QR" | "LINE_QR";

/**
 * Supplies a raster for a QR payload when the printer cannot print native QR
 * (or for LINE QR images, which are never native). The returned bitmap must
 * follow the raster input contract of escpos.ts: raw 1-bit-per-pixel rows,
 * MSB-first (1 = black), packed to whole bytes per row, top row first, plus
 * its width in dots. Return null when no bitmap can be produced.
 */
export type BitmapForQr = (
  payload: string,
  target: PrintQrBitmapTarget,
) => { bytes: Uint8Array; widthDots: number } | null;

export type ComposeReport = {
  skippedQrBlocks: { kind: PrintQrBlock["kind"]; reason: string }[];
  textEncoding: "TIS620";
  widthDots: number;
};

export type ComposeResult = {
  operations: PrintOperation[];
  report: ComposeReport;
};

export type ComposePrintOptions = {
  /** Raster provider for QR blocks when native QR is unavailable. */
  bitmapFor?: BitmapForQr;
  /** Max raster band height in dots (PRN-05 band splitting). Default 64. */
  bandHeightDots?: number;
  /** Tear-off feed lines before the cut. Default 4. */
  tearOffFeedLines?: number;
  /** Native QR module size (1..16). Default: 6 on 80 mm, 5 on 58 mm. */
  nativeQrModuleSize?: number;
};

const DEFAULT_BAND_HEIGHT_DOTS = 64;
const DEFAULT_TEAR_OFF_FEED_LINES = 4;

// ============================
// MONEY DISPLAY (C10 boundary)
// ============================
//
// Display-only formatting of integer minor units (satang). Pure integer
// math: no floats, no rounding — the value is already exact.

export function formatMinor(amountMinor: number): string {
  if (!Number.isInteger(amountMinor)) {
    throw new Error("formatMinor requires an integer number of minor units");
  }
  const negative = amountMinor < 0;
  const abs = Math.abs(amountMinor);
  const baht = Math.floor(abs / 100);
  const satang = abs % 100;
  const bahtDigits = baht.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${bahtDigits}.${satang.toString().padStart(2, "0")}`;
}

// ============================
// DATE DISPLAY (Asia/Bangkok semantics)
// ============================

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Formats an ISO 8601 instant as "d/m/yyyy HH:mm" in Asia/Bangkok time.
 * (Named to avoid the Nuxt auto-import collision with server/utils/csv.ts.)
 */
export function formatBangkokDateTime(iso: string): string {
  const epochMs = Date.parse(iso);
  if (Number.isNaN(epochMs)) return iso;
  const bangkok = new Date(epochMs + BANGKOK_OFFSET_MS);
  const padTwo = (value: number) => value.toString().padStart(2, "0");
  return `${bangkok.getUTCDate()}/${bangkok.getUTCMonth() + 1}/${bangkok.getUTCFullYear()} `
    + `${padTwo(bangkok.getUTCHours())}:${padTwo(bangkok.getUTCMinutes())}`;
}

// ============================
// COMPOSER
// ============================

const DOCUMENT_TITLES: Record<PrintDocument["kind"], string> = {
  QUOTATION: "ใบเสนอราคา",
  RECEIPT: "ใบเสร็จรับเงิน",
};

function separatorLine(columns: number): string {
  return "-".repeat(columns);
}

/** "label......value" right-aligned within `columns` display columns. */
function twoColumnLine(label: string, value: string, columns: number): string {
  const used = displayWidth(label) + displayWidth(value);
  if (used >= columns) return `${label} ${value}`;
  return `${label}${" ".repeat(columns - used)}${value}`;
}

/**
 * Composes the print operation stream. Always starts with `initialize` and
 * ends with `feed` (tear-off margin) plus `partialCut` only when the profile
 * verified that capability.
 */
export function composePrintOperations(
  document: PrintDocument,
  profile: PrinterProfile,
  options: ComposePrintOptions = {},
): ComposeResult {
  const bandHeightDots = options.bandHeightDots ?? DEFAULT_BAND_HEIGHT_DOTS;
  const tearOffFeedLines = options.tearOffFeedLines ?? DEFAULT_TEAR_OFF_FEED_LINES;
  const nativeQrModuleSize = options.nativeQrModuleSize
    ?? (profile.paperWidthMm === 58 ? 5 : 6);
  const columns = columnsForProfile(profile);

  const operations: PrintOperation[] = [];
  const pushText = (
    value: string,
    style?: "normal" | "bold" | "large",
    align?: "left" | "center" | "right",
  ) => {
    operations.push({ type: "text", value, ...(style ? { style } : {}), ...(align ? { align } : {}) });
  };

  operations.push({ type: "initialize" });

  // ---- Shop header (centered) ----
  pushText(document.shop.name, "large", "center");
  if (document.shop.addressLine) pushText(document.shop.addressLine, "normal", "center");
  if (document.shop.phoneNumber) pushText(`โทร: ${document.shop.phoneNumber}`, "normal", "center");
  if (document.shop.taxId) pushText(`เลขผู้เสียภาษี: ${document.shop.taxId}`, "normal", "center");
  pushText(separatorLine(columns));

  // ---- Document identity ----
  pushText(DOCUMENT_TITLES[document.kind], "bold", "center");
  pushText(`เลขที่: ${document.documentNo}`);
  pushText(`วันที่: ${formatBangkokDateTime(document.issuedAt)}`);
  if (document.revision > 1) pushText(`ฉบับที่: ${document.revision}`);
  pushText(`ลูกค้า: ${document.customer.name}`);
  if (document.customer.phoneNumber) pushText(`โทร: ${document.customer.phoneNumber}`);
  pushText(separatorLine(columns));

  // ---- Line items (display-only money from integer minor units) ----
  for (const item of document.items) {
    pushText(item.name);
    if (item.note) pushText(`  * ${item.note}`);
    const left = `  ${item.quantity} x ${formatMinor(item.unitPriceMinor)}`;
    const right = formatMinor(item.totalPriceMinor);
    if (displayWidth(left) + displayWidth(right) + 1 <= columns) {
      pushText(twoColumnLine(left, right, columns));
    } else {
      pushText(left);
      pushText(right, "normal", "right");
    }
  }
  pushText(separatorLine(columns));

  // ---- Totals ----
  pushText(twoColumnLine("รวมมูลค่า", formatMinor(document.totals.subtotalAmountMinor), columns));
  if (document.totals.discountAmountMinor > 0) {
    pushText(twoColumnLine("ส่วนลด", formatMinor(document.totals.discountAmountMinor), columns));
  }
  pushText(twoColumnLine("ยอดรวม", formatMinor(document.totals.totalAmountMinor), columns), "bold");
  if (document.note) {
    pushText(`หมายเหตุ: ${document.note}`);
  }

  // ---- QR blocks (server-built; same payload for native and raster paths) ----
  const skippedQrBlocks: ComposeReport["skippedQrBlocks"] = [];
  for (const block of document.qrBlocks) {
    if (block.kind === "PAYMENT") {
      pushText(block.caption, "normal", "center");
      if (profile.capabilities.nativeQr) {
        operations.push({ type: "nativeQr", data: block.payload, size: nativeQrModuleSize });
      } else {
        const bitmap = options.bitmapFor?.(block.payload, "PAYMENT_QR") ?? null;
        const emitted = pushQrRaster(bitmap, profile, bandHeightDots, operations);
        if (!emitted) {
          skippedQrBlocks.push({ kind: "PAYMENT", reason: "NO_NATIVE_QR_AND_NO_BITMAP" });
        }
      }
    } else {
      pushText(block.caption, "normal", "center");
      // LINE QR is image-based (imageUrl); it is never a native QR operation.
      // The server/bridge resolves the image; the composer only routes the
      // payload through the bitmap provider.
      const bitmap = options.bitmapFor?.(block.imageUrl, "LINE_QR") ?? null;
      const emitted = pushQrRaster(bitmap, profile, bandHeightDots, operations);
      if (!emitted) {
        skippedQrBlocks.push({ kind: "LINE", reason: "NO_BITMAP_PROVIDER" });
      }
    }
  }

  // ---- Tear-off feed and cut ----
  operations.push({ type: "feed", lines: tearOffFeedLines });
  if (profile.capabilities.partialCut) {
    operations.push({ type: "partialCut" });
  }

  return {
    operations,
    report: {
      skippedQrBlocks,
      textEncoding: "TIS620",
      widthDots: profile.printableDots,
    },
  };
}

/**
 * Emits band-split raster operations for a provider bitmap. Returns false when
 * no bitmap was supplied or the bitmap cannot fit the printable width (the QR
 * block is then recorded as skipped instead of failing the whole receipt).
 */
function pushQrRaster(
  bitmap: { bytes: Uint8Array; widthDots: number } | null,
  profile: PrinterProfile,
  bandHeightDots: number,
  operations: PrintOperation[],
): boolean {
  if (!bitmap) return false;
  if (bitmap.widthDots < 1 || bitmap.widthDots > profile.printableDots) return false;
  for (const band of splitRasterBands(bitmap.bytes, bitmap.widthDots, bandHeightDots)) {
    operations.push({ type: "raster", bytes: band, widthDots: bitmap.widthDots });
  }
  return true;
}
