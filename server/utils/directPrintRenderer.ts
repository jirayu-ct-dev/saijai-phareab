import * as fontkit from "fontkit";
import type { Font } from "fontkit";
import QRCode from "qrcode";
import sharp from "sharp";
import type {
  PrintDocument,
  PrintOperation,
  PrinterProfile,
  ThaiPrintStrategy,
} from "~~/shared/types/printing";
import { composePrintOperations } from "~~/shared/utils/printComposer";
import { encodeEscpos, splitRasterBands, wrapText } from "~~/shared/utils/escpos";

const containsThai = (value: string) => /[\u0E00-\u0E7F]/u.test(value);
export const createDirectPrinterProfile = (widthDots: 384 | 576): PrinterProfile => ({
  id: "direct-local",
  name: "XP-C260M",
  model: "XP-C260M",
  defaultTransport: "WIFI",
  paperWidthMm: widthDots === 384 ? 58 : 80,
  printableDots: widthDots,
  renderMode: "HYBRID",
  capabilities: {
    // Confirmed by the physical XP-C260M self-test. The composer emits one
    // cut only after the complete document and tear-off feed.
    partialCut: true,
    nativeQr: false,
    nativeBarcode: false,
    pdf417: false,
    nvLogo: false,
    buzzer: false,
    statusQuery: false,
    cashDrawer: false,
    blackMark: false,
  },
});

async function pngToBitmap(png: Buffer, widthDots: number) {
  const width = Math.max(8, Math.floor(widthDots / 8) * 8);
  const { data, info } = await sharp(png)
    .flatten({ background: "#ffffff" })
    .resize({ width, fit: "inside", withoutEnlargement: false })
    .grayscale()
    .threshold(165)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rowBytes = Math.ceil(info.width / 8);
  const packed = new Uint8Array(rowBytes * info.height);
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if ((data[y * info.width + x] ?? 255) < 128) {
        packed[y * rowBytes + (x >> 3)]! |= 1 << (7 - (x & 7));
      }
    }
  }
  return { bytes: packed, widthDots: info.width };
}

const promptFontCache = new Map<400 | 700, Promise<Font>>();

const loadPrintAsset = async (key: string, missingMessage: string) => {
  const value = await useStorage("assets:printing").getItemRaw(key);
  if (!(value instanceof Uint8Array)) throw new Error(missingMessage);
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
};

const loadPromptFont = async (weight: 400 | 700) => {
  const cached = promptFontCache.get(weight);
  if (cached) return cached;
  const loading = loadBundledPromptFont(weight);
  promptFontCache.set(weight, loading);
  return loading;
};

const loadBundledPromptFont = async (weight: 400 | 700) => {
  const filename = `Prompt-normal-${weight}-thai.woff2`;
  const font = fontkit.create(
    await loadPrintAsset(`fonts/${filename}`, "Thai print font is unavailable"),
  );
  if (!("layout" in font)) throw new Error("Thai print font is unavailable");
  return font;
};

const shapedText = (
  value: string,
  font: Font,
  fontSize: number,
  x: number,
  baseline: number,
) => {
  if (!value) return { path: "", width: 0 };
  const scale = fontSize / font.unitsPerEm;
  const run = font.layout(value);
  let cursorX = x;
  let cursorY = baseline;
  const paths: string[] = [];
  for (let index = 0; index < run.glyphs.length; index += 1) {
    const glyph = run.glyphs[index];
    const position = run.positions[index];
    if (!glyph || !position) continue;
    const data = glyph.path
      .scale(scale, -scale)
      .translate(
        cursorX + position.xOffset * scale,
        cursorY - position.yOffset * scale,
      )
      .toSVG();
    if (data) paths.push(`<path d="${data}"/>`);
    cursorX += position.xAdvance * scale;
    cursorY -= position.yAdvance * scale;
  }
  return { path: paths.join(""), width: run.advanceWidth * scale };
};

async function thaiTextBitmap(operation: Extract<PrintOperation, { type: "text" }>, profile: PrinterProfile) {
  const scale = operation.style === "large" ? 1.5 : 1;
  const fontSize = Math.round(24 * scale);
  const lineHeight = Math.ceil(fontSize * 1.55);
  const columns = profile.paperWidthMm === 58 ? 32 : 48;
  const tableLines = operation.tableColumns
    ? wrapText(operation.tableColumns.item, Math.max(8, Math.floor(columns * 0.42 / scale)))
    : null;
  const lines = tableLines ?? wrapText(operation.value, Math.max(8, Math.floor(columns / scale)));
  const height = Math.max(lineHeight + 8, lines.length * lineHeight + 8);
  const anchor = operation.align === "center" ? "middle" : operation.align === "right" ? "end" : "start";
  const x = operation.align === "center" ? profile.printableDots / 2 : operation.align === "right" ? profile.printableDots - 4 : 4;
  const weight: 400 | 700 = operation.style === "bold" || operation.style === "large" ? 700 : 400;
  const font = await loadPromptFont(weight);
  const baseline = 4 + font.ascent * fontSize / font.unitsPerEm;
  const text = operation.tableColumns
    ? [
        ...lines.map((line, index) =>
          shapedText(line, font, fontSize, 4, baseline + index * lineHeight).path),
        ...[
          [operation.tableColumns.unitPrice, Math.round(profile.printableDots * 0.64)],
          [operation.tableColumns.quantity, Math.round(profile.printableDots * 0.77)],
          [operation.tableColumns.total, profile.printableDots - 4],
        ].map(([value, right]) => {
          const measured = shapedText(String(value), font, fontSize, 0, baseline);
          return shapedText(String(value), font, fontSize, Number(right) - measured.width, baseline).path;
        }),
      ].join("")
    : operation.columns
    ? (() => {
        const right = shapedText(operation.columns.right, font, fontSize, 0, baseline);
        return [
          shapedText(operation.columns.left, font, fontSize, 4, baseline).path,
          shapedText(operation.columns.right, font, fontSize, profile.printableDots - 4 - right.width, baseline).path,
        ].join("");
      })()
    : lines.map((line, index) => {
        const measured = shapedText(line, font, fontSize, 0, baseline);
        const lineX = anchor === "middle" ? x - measured.width / 2 : anchor === "end" ? x - measured.width : x;
        return shapedText(line, font, fontSize, lineX, baseline + index * lineHeight).path;
      }).join("");
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${profile.printableDots}" height="${height}">
    <rect width="100%" height="100%" fill="#fff"/><g fill="#000">${text}</g></svg>`);
  return pngToBitmap(await sharp(svg).png().toBuffer(), profile.printableDots);
}

/** Force one text block through the deployment-safe raster path. */
export async function rasterizeTextOperation(
  operation: Extract<PrintOperation, { type: "text" }>,
  profile: PrinterProfile,
): Promise<PrintOperation[]> {
  const bitmap = await thaiTextBitmap(operation, profile);
  return splitRasterBands(bitmap.bytes, bitmap.widthDots, 64)
    .map((band) => ({ type: "raster", bytes: band, widthDots: bitmap.widthDots }));
}

async function paymentQrBitmap(payload: string, profile: PrinterProfile) {
  const width = profile.paperWidthMm === 58 ? 232 : 280;
  const png = await QRCode.toBuffer(payload, { type: "png", errorCorrectionLevel: "M", margin: 2, width });
  return centeredSquareBitmap(png, width, profile.printableDots);
}

async function centeredSquareBitmap(source: Buffer, contentWidth: number, printableDots: number) {
  const left = Math.floor((printableDots - contentWidth) / 2);
  const right = printableDots - contentWidth - left;
  const centered = await sharp(source)
    .flatten({ background: "#ffffff" })
    .resize({ width: contentWidth, height: contentWidth, fit: "contain", background: "#ffffff" })
    .extend({ left, right, top: 0, bottom: 0, background: "#ffffff" })
    .png()
    .toBuffer();
  return pngToBitmap(centered, printableDots);
}

async function lineQrBitmap(imageUrl: string, profile: PrinterProfile) {
  const url = new URL(imageUrl);
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") return null;
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(5_000) });
  if (!response.ok) return null;
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > 2_000_000) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > 2_000_000) return null;
  return centeredSquareBitmap(
    bytes,
    profile.paperWidthMm === 58 ? 232 : 280,
    profile.printableDots,
  );
}

async function shopLogoBitmap(logoUrl: string | null | undefined, profile: PrinterProfile) {
  if (logoUrl !== "/logo-saijai-phareab.png") return null;
  const source = await loadPrintAsset(
    "logo-saijai-phareab.png",
    "Shop print logo is unavailable",
  );
  const logoWidth = profile.paperWidthMm === 58 ? 112 : 144;
  const left = Math.floor((profile.printableDots - logoWidth) / 2);
  const right = profile.printableDots - logoWidth - left;
  const centered = await sharp(source)
    .resize({ width: logoWidth, height: logoWidth, fit: "contain", background: "#ffffff" })
    .flatten({ background: "#ffffff" })
    .extend({ top: 4, bottom: 8, left, right, background: "#ffffff" })
    .png()
    .toBuffer();
  return pngToBitmap(centered, profile.printableDots);
}

export async function rasterizeThaiOperations(operations: PrintOperation[], profile: PrinterProfile) {
  const result: PrintOperation[] = [];
  for (const operation of operations) {
    if (operation.type !== "text" || (!operation.tableColumns && !containsThai(operation.value))) {
      result.push(operation);
      continue;
    }
    result.push(...await rasterizeTextOperation(operation, profile));
  }
  return result;
}

/**
 * Builds Hybrid ESC/POS bytes. ASCII remains native while every text block
 * containing Thai is rasterized with the bundled Prompt font by default.
 * Native Thai pages are retained only for explicit diagnostics.
 */
export async function renderDirectEscpos(
  document: PrintDocument,
  widthDots: 384 | 576,
  thaiStrategy: ThaiPrintStrategy = "raster-thai",
) {
  const profile = createDirectPrinterProfile(widthDots);
  const logoBitmap = await shopLogoBitmap(document.shop.logoUrl, profile);
  const qrBitmaps = new Map<string, { bytes: Uint8Array; widthDots: number }>();
  for (const block of document.qrBlocks) {
    try {
      const bitmap = block.kind === "PAYMENT"
        ? await paymentQrBitmap(block.payload, profile)
        : await lineQrBitmap(block.imageUrl, profile);
      if (bitmap) qrBitmaps.set(`${block.kind}:${block.kind === "PAYMENT" ? block.payload : block.imageUrl}`, bitmap);
    } catch { /* QR remains omitted and the rest of the document still prints */ }
  }
  const composed = composePrintOperations(document, profile, {
    logoBitmap,
    bitmapFor: (payload, target) => qrBitmaps.get(`${target === "PAYMENT_QR" ? "PAYMENT" : "LINE"}:${payload}`) ?? null,
  });
  const operations = thaiStrategy === "raster-thai"
    ? await rasterizeThaiOperations(composed.operations, profile)
    : composed.operations;
  return {
    bytes: encodeEscpos(operations, profile, { thaiStrategy }),
    report: {
      ...composed.report,
      textEncoding: thaiStrategy === "raster-thai"
        ? "ASCII_NATIVE_THAI_RASTER"
        : thaiStrategy === "native-thai-255" ? "THAI_PAGE_255" : "CP874",
    },
    document,
    thaiStrategy,
  };
}
