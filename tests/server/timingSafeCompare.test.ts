import { describe, expect, it } from "vitest";
import { timingSafeCompareStrings } from "../../server/utils/timingSafeCompare";

describe("timingSafeCompareStrings", () => {
  it("accepts equal values and rejects different values", () => {
    const secret = "cron-secret-with-random-entropy";
    expect(timingSafeCompareStrings(secret, secret)).toBe(true);
    expect(timingSafeCompareStrings(secret, `${secret}x`)).toBe(false);
    expect(timingSafeCompareStrings(secret, "")).toBe(false);
    expect(timingSafeCompareStrings("", "")).toBe(true);
  });

  it("handles values of very different lengths without throwing", () => {
    expect(timingSafeCompareStrings("a", "a".repeat(10_000))).toBe(false);
    expect(timingSafeCompareStrings("a".repeat(10_000), "a")).toBe(false);
  });
});
