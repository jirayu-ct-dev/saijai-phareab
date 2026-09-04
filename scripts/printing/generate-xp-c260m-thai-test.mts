import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  createDirectPrinterProfile,
  rasterizeTextOperation,
} from "../../server/utils/directPrintRenderer";
import { encodeEscpos } from "../../shared/utils/escpos";

const outputArg = process.argv.slice(2).find((argument) => argument !== "--");
if (!outputArg) {
  console.error("Usage: pnpm print:test-receipt -- /absolute/path/xp-c260m-minimal-raster.bin");
  process.exit(64);
}

const outputPath = path.resolve(outputArg);
const printerProfile = createDirectPrinterProfile(576);
const minimalRasterProfile = { ...printerProfile, printableDots: 288 };
const asciiRaster = await rasterizeTextOperation(
  { type: "text", value: "TEST 123", align: "left" },
  minimalRasterProfile,
);
const thaiRaster = await rasterizeTextOperation(
  { type: "text", value: "ทดสอบไทย", align: "left" },
  minimalRasterProfile,
);
const bytes = encodeEscpos([
  { type: "initialize" },
  ...asciiRaster,
  ...thaiRaster,
  { type: "feed", lines: 2 },
], printerProfile);
await writeFile(outputPath, bytes);
console.log(JSON.stringify({
  outputPath,
  byteLength: bytes.byteLength,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  rasterWidthDots: minimalRasterProfile.printableDots,
  rasterWidthBytes: minimalRasterProfile.printableDots / 8,
  strategy: "raster-thai",
  cut: false,
}));
