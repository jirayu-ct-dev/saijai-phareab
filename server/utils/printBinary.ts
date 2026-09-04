import type { PrintByteFingerprint } from "~~/shared/utils/printByteFingerprint";
import { fingerprintPrintBytes } from "~~/shared/utils/printByteFingerprint";

/** Make the Nitro response boundary explicitly Node-binary and byte-exact. */
export const toPrintResponseBuffer = (bytes: Uint8Array): Buffer =>
  Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);

export async function debugPrintBytes(
  stage: "A_RENDERER" | "B_ENDPOINT",
  bytes: Uint8Array,
): Promise<PrintByteFingerprint | null> {
  if (process.env.NODE_ENV === "production" || process.env.PRINT_DEBUG_BYTES !== "true") return null;
  const fingerprint = await fingerprintPrintBytes(bytes);
  console.debug(`[print-bytes:${stage}]`, fingerprint);
  return fingerprint;
}
