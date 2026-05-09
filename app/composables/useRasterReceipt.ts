// Raster receipt printing — renders a DOM element to a 1-bit bitmap and emits
// ESC/POS `GS v 0` raster commands. This bypasses printer-side Thai codepage
// support entirely, so Thai characters, vowels, and tone marks always render
// exactly as shown in the web preview.
//
// Output sequence:
//   NUL × 8          — flush any stale bytes the printer parser was halfway
//                      through (printers ignore 0x00 outside command context)
//   CAN              — cancel any in-flight bitmap data from a prior session
//   ESC @            — full reset (clears character set, line spacing, etc.)
//   ESC 2            — restore default line spacing (some printers persist a
//                      tightened spacing across reset on certain firmwares)
//   ESC a 0          — left-align (raster fills full width, but be explicit)
//   ESC p 0 60 120   — open cash drawer (optional)
//   GS v 0 m xL xH yL yH d…  — raster image, sent in row-chunks for compat
//   ESC d 2          — feed
//   GS V 1           — partial cut
//   ESC @            — final reset so next session starts clean
//
// Width is fixed by paper size — 80mm (576 dots) or 58mm (384 dots) at 203dpi.
//
// Why the aggressive prelude? — without it, the first few bytes of a raster
// command can be misinterpreted as text if the printer was left mid-command
// (BLE drop, USB interface change, prior text-mode session). The result is
// random "garbage" Thai/CP characters at the very top of the slip. NUL+CAN+
// ESC@ resets all three layers (parser state, bitmap buffer, character mode).

const ESC = 0x1B
const GS = 0x1D
const CAN = 0x18
const NUL = 0x00

const PAPER_DOTS = { 80: 576, 58: 384 } as const

// Send raster in chunks of N rows so dumb printers with small input buffers
// don't choke. ~128 rows per command is widely supported.
const ROWS_PER_CHUNK = 128

const downloadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

async function renderElementToCanvas(
  element: HTMLElement,
  targetWidthPx: number,
): Promise<HTMLCanvasElement> {
  // Sharpness recipe:
  //   1. Render the DOM at its NATURAL width — never upscale (upscaling text is
  //      always blurry).
  //   2. Use a high pixelRatio so the source bitmap is ~2× larger than the
  //      printer's pixel width.
  //   3. Downsample to the printer's exact width with high-quality smoothing.
  //   Down-sampling preserves stroke geometry; up-sampling ruins it.
  const { toPng } = await import('html-to-image')

  // Wait for fonts to be ready — Thai webfonts load async and html-to-image
  // will rasterize a fallback font if we snapshot too early.
  if ('fonts' in document) await document.fonts.ready

  const naturalWidth = element.scrollWidth || 390
  const naturalHeight = element.scrollHeight
  // ~2× super-sample of the printer width gives sharp text after downsample.
  const supersample = Math.max(2, Math.ceil((targetWidthPx * 2) / naturalWidth))

  const dataUrl = await toPng(element, {
    backgroundColor: '#ffffff',
    cacheBust: true,
    width: naturalWidth,
    height: naturalHeight,
    pixelRatio: supersample,
  })
  const img = await downloadImage(dataUrl)

  const scale = targetWidthPx / img.width
  const targetHeight = Math.round(img.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = targetWidthPx
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas
}

// Floyd–Steinberg dithering → 1-bit packed bytes (MSB = leftmost pixel).
// Result is row-major, ceil(width/8) bytes per row.
function canvasTo1Bit(canvas: HTMLCanvasElement): { bytes: Uint8Array; width: number; height: number } {
  const { width, height } = canvas
  const ctx = canvas.getContext('2d')!
  const img = ctx.getImageData(0, 0, width, height)

  // Pure threshold (NOT dither) — receipts are 99% text, and dithering smears
  // anti-aliased edges into noisy speckle. A sharp cutoff at ~165 keeps thin
  // Thai strokes / tone marks visible without bloating bold text.
  // (Threshold > 128 makes mid-gray edges fall to BLACK, slightly thickening
  //  strokes — important on 203dpi thermals where 1 dot ≈ 0.125mm.)
  const THRESHOLD = 165

  const bytesPerRow = Math.ceil(width / 8)
  const bytes = new Uint8Array(bytesPerRow * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const r = img.data[i]!
      const g = img.data[i + 1]!
      const b = img.data[i + 2]!
      const a = img.data[i + 3]! / 255
      const lum = (r * 0.299 + g * 0.587 + b * 0.114) * a + 255 * (1 - a)
      if (lum < THRESHOLD) {
        const bi = y * bytesPerRow + (x >> 3)
        bytes[bi] = (bytes[bi] ?? 0) | (1 << (7 - (x & 7)))
      }
    }
  }
  return { bytes, width, height }
}

function concatBytes(...parts: Array<Uint8Array | number[]>): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) { out.set(p instanceof Uint8Array ? p : Uint8Array.from(p), o); o += p.length }
  return out
}

export async function buildRasterBytes(
  element: HTMLElement,
  paperWidth: 58 | 80,
  openDrawer = false,
): Promise<Uint8Array> {
  if (!import.meta.client) throw new Error('raster printing requires a browser')

  const targetWidth = PAPER_DOTS[paperWidth]
  const canvas = await renderElementToCanvas(element, targetWidth)
  const { bytes, width, height } = canvasTo1Bit(canvas)
  const bytesPerRow = Math.ceil(width / 8)

  const init: number[] = [
    NUL, NUL, NUL, NUL, NUL, NUL, NUL, NUL, // flush stale parser state
    CAN,                                     // cancel any in-flight bitmap
    ESC, 0x40,                               // ESC @ — full reset
    ESC, 0x32,                               // ESC 2 — default line spacing
    ESC, 0x61, 0,                            // ESC a 0 — left align
  ]
  const drawer: number[] = openDrawer ? [ESC, 0x70, 0, 60, 120] : []

  // Split into row-chunks; each chunk is a separate GS v 0 command.
  const chunks: Uint8Array[] = []
  for (let y = 0; y < height; y += ROWS_PER_CHUNK) {
    const rows = Math.min(ROWS_PER_CHUNK, height - y)
    const header = Uint8Array.from([
      GS, 0x76, 0x30, 0,
      bytesPerRow & 0xFF, (bytesPerRow >> 8) & 0xFF,
      rows & 0xFF, (rows >> 8) & 0xFF,
    ])
    const slice = bytes.slice(y * bytesPerRow, (y + rows) * bytesPerRow)
    chunks.push(header, slice)
  }

  const tail: number[] = [
    ESC, 0x64, 2,        // feed 2 lines
    GS, 0x56, 1,         // partial cut
    ESC, 0x40,           // final ESC @ — leave printer in clean state
  ]

  return concatBytes(init, drawer, ...chunks, tail)
}
