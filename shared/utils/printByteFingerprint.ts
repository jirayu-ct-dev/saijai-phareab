export type PrintByteFingerprint = {
  byteLength: number;
  sha256: string;
  first32Hex: string;
  last16Hex: string;
};

const toHex = (bytes: Uint8Array) => Array.from(bytes)
  .map((byte) => byte.toString(16).padStart(2, "0"))
  .join("");

/** Diagnostic metadata only. Never converts the print stream itself to text. */
export async function fingerprintPrintBytes(bytes: Uint8Array): Promise<PrintByteFingerprint> {
  const stable = Uint8Array.from(bytes);
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", stable));
  return {
    byteLength: stable.byteLength,
    sha256: toHex(digest),
    first32Hex: toHex(stable.subarray(0, 32)),
    last16Hex: toHex(stable.subarray(Math.max(0, stable.byteLength - 16))),
  };
}
