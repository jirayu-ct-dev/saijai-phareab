import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../../server/utils/rateLimit";

describe("createRateLimiter", () => {
  it("allows up to max attempts per key within the window then blocks", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    const t0 = 1_000_000;
    expect(limiter.check("k", t0)).toBe(true);
    expect(limiter.check("k", t0 + 1)).toBe(true);
    expect(limiter.check("k", t0 + 2)).toBe(true);
    expect(limiter.check("k", t0 + 3)).toBe(false);
  });

  it("resets the window after it elapses and tracks keys independently", () => {
    const limiter = createRateLimiter({ windowMs: 1_000, max: 1 });
    const t0 = 2_000_000;
    expect(limiter.check("a", t0)).toBe(true);
    expect(limiter.check("a", t0 + 1)).toBe(false);
    expect(limiter.check("b", t0 + 1)).toBe(true);
    expect(limiter.check("a", t0 + 1_001)).toBe(true);
  });

  it("reset() forgets recorded attempts", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    limiter.check("a");
    expect(limiter.check("a")).toBe(false);
    limiter.reset();
    expect(limiter.check("a")).toBe(true);
  });
});
