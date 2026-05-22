// Convert a PNG buffer (rendered by Puppeteer) into a complete ESC/POS print
// job that prints as a raster image via `GS v 0`. Output bytes can be sent
// straight to the printer (USB / BLE / TCP).
//
// Pipeline:
//   PNG (any size) → sharp resize to printer-width → grayscale → threshold
//   1-bit pack → ESC/POS GS v 0 chunks → init/cut envelope.

import sharp from "sharp";

const ESC = 0x1B;
const GS = 0x1D;
const CAN = 0x18;
const NUL = 0x00;

const PAPER_DOTS = { 80: 576, 58: 384 } as const;
type PaperWidth = keyof typeof PAPER_DOTS;

const ROWS_PER_CHUNK = 128;
// Threshold biased above midpoint — keeps thin Thai strokes visible on 203dpi
// thermal heads without bloating bold text.
const THRESHOLD = 165;

export interface EscposBuildOptions {
  pngBytes: Buffer;
  paperWidth: PaperWidth;
  openDrawer?: boolean;
}

async function pngToBitmap(pngBytes: Buffer, targetWidth: number) {
  // 1. Resize to printer width (round to multiple of 8 for byte-aligned rows).
  // 2. Flatten alpha onto white so semi-transparent pixels don't read as black.
  // 3. Grayscale + threshold to 1-bit.
  const resized = await sharp(pngBytes)
    .flatten({ background: "#ffffff" })
    .resize({ width: targetWidth, kernel: sharp.kernel.lanczos3, withoutEnlargement: false })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = resized;
  const width = info.width;
  const height = info.height;
  const bytesPerRow = Math.ceil(width / 8);
  const out = new Uint8Array(bytesPerRow * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const lum = data[y * width + x] ?? 255;
      if (lum < THRESHOLD) {
        const bi = y * bytesPerRow + (x >> 3);
        out[bi] = (out[bi] ?? 0) | (1 << (7 - (x & 7)));
      }
    }
  }
  return { bytes: out, width, height, bytesPerRow };
}

function concatBytes(...parts: Array<Uint8Array | number[]>): Buffer {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p instanceof Uint8Array ? p : Uint8Array.from(p), o);
    o += p.length;
  }
  return Buffer.from(out);
}

export async function buildEscposBytes(opts: EscposBuildOptions): Promise<Buffer> {
  const targetWidth = PAPER_DOTS[opts.paperWidth];
  const { bytes, height, bytesPerRow } = await pngToBitmap(opts.pngBytes, targetWidth);

  // Aggressive init prelude — kills the random garbage at top of slip caused
  // by stale parser state from a prior session (BLE drop, USB swap, etc.):
  //   NUL × 8: flush half-parsed command bytes
  //   CAN:     cancel any in-flight bitmap
  //   ESC @:   full reset
  //   ESC 2:   default line spacing
  //   ESC a 0: explicit left align
  const init: number[] = [
    NUL, NUL, NUL, NUL, NUL, NUL, NUL, NUL,
    CAN,
    ESC, 0x40,
    ESC, 0x32,
    ESC, 0x61, 0,
  ];
  const drawer: number[] = opts.openDrawer ? [ESC, 0x70, 0, 60, 120] : [];

  const chunks: Uint8Array[] = [];
  for (let y = 0; y < height; y += ROWS_PER_CHUNK) {
    const rows = Math.min(ROWS_PER_CHUNK, height - y);
    const header = Uint8Array.from([
      GS, 0x76, 0x30, 0,
      bytesPerRow & 0xFF, (bytesPerRow >> 8) & 0xFF,
      rows & 0xFF, (rows >> 8) & 0xFF,
    ]);
    const slice = bytes.slice(y * bytesPerRow, (y + rows) * bytesPerRow);
    chunks.push(header, slice);
  }

  const tail: number[] = [
    ESC, 0x64, 2,    // feed 2 lines
    GS, 0x56, 1,     // partial cut
    ESC, 0x40,       // final reset — leave printer clean for next job
  ];

  return concatBytes(init, drawer, ...chunks, tail);
}
