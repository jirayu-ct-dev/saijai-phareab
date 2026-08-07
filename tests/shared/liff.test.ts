import { describe, expect, it } from "vitest";
import { hasLiffLaunchMarker, isLineClientUserAgent, isPotentialLiffLaunch } from "../../shared/utils/liff";

describe("LIFF launch detection", () => {
  it("detects the LINE and LIFF user agents", () => {
    expect(isLineClientUserAgent("Mozilla/5.0 Line/15.0.0")).toBe(true);
    expect(isLineClientUserAgent("Mozilla/5.0 LIFF")).toBe(true);
    expect(isLineClientUserAgent("Mozilla/5.0 Safari/605.1.15")).toBe(false);
  });

  it("detects LIFF primary redirect query and token fragments", () => {
    expect(hasLiffLaunchMarker("https://example.com/?liff.state=%2Fpricing")).toBe(true);
    expect(hasLiffLaunchMarker("https://example.com/#context_token=secret&id_token=secret")).toBe(true);
    expect(hasLiffLaunchMarker("https://example.com/pricing")).toBe(false);
  });

  it("keeps detecting a secondary redirect with persisted launch context", () => {
    expect(isPotentialLiffLaunch("Mozilla/5.0 Safari/605.1.15", "https://example.com/pricing", true)).toBe(true);
  });

  it("fails closed for malformed URLs", () => {
    expect(hasLiffLaunchMarker("not a url")).toBe(false);
  });
});
