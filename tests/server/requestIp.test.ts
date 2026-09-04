import { describe, expect, it } from "vitest";
import { resolveRateLimitClientIp } from "../../server/utils/requestIp";

describe("rate-limit client IP resolution", () => {
  const trusted = ["127.0.0.1", "10.0.0.2"];

  it("ignores forwarded headers from an untrusted direct peer", () => {
    expect(resolveRateLimitClientIp("203.0.113.8", "198.51.100.1", trusted)).toBe("203.0.113.8");
  });

  it("uses the client address appended by one trusted proxy", () => {
    expect(resolveRateLimitClientIp("127.0.0.1", "198.51.100.9", trusted)).toBe("198.51.100.9");
    expect(resolveRateLimitClientIp("::ffff:127.0.0.1", "198.51.100.9", trusted)).toBe("198.51.100.9");
  });

  it("walks past multiple trusted proxies and ignores spoofed left-side entries", () => {
    expect(resolveRateLimitClientIp(
      "127.0.0.1",
      "192.0.2.77, 198.51.100.9, 10.0.0.2",
      trusted,
    )).toBe("198.51.100.9");
  });

  it("falls back safely when no address is available", () => {
    expect(resolveRateLimitClientIp("", undefined, trusted)).toBe("unknown");
  });
});
