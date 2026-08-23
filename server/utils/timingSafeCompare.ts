import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison for shared secrets. Both values are
 * SHA-256 hashed first so the compared length is fixed and differing
 * input lengths cannot short-circuit the comparison.
 */
export function timingSafeCompareStrings(a: string, b: string): boolean {
  const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(sha256(a), sha256(b));
}
