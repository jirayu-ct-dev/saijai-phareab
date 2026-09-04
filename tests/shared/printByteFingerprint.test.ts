import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fingerprintPrintBytes } from "../../shared/utils/printByteFingerprint";

describe("print byte fingerprint", () => {
  it("reports byte-exact diagnostics without changing binary input", async () => {
    const bytes = Uint8Array.from({ length: 48 }, (_, index) => (index * 53) & 0xff);
    const before = Uint8Array.from(bytes);
    const result = await fingerprintPrintBytes(bytes);

    expect(result.byteLength).toBe(bytes.byteLength);
    expect(result.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(result.first32Hex).toBe(Buffer.from(bytes.subarray(0, 32)).toString("hex"));
    expect(result.last16Hex).toBe(Buffer.from(bytes.subarray(32)).toString("hex"));
    expect(bytes).toEqual(before);
  });
});
