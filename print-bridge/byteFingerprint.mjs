import { createHash } from "node:crypto";

export function fingerprintBuffer(bytes) {
  if (!Buffer.isBuffer(bytes)) throw new TypeError("Print payload must be a Buffer");
  return {
    byteLength: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    first32Hex: bytes.subarray(0, 32).toString("hex"),
    last16Hex: bytes.subarray(Math.max(0, bytes.byteLength - 16)).toString("hex"),
  };
}
