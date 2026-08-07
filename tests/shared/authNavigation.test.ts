import { describe, expect, it } from "vitest";
import { getSafeInternalRedirect } from "../../shared/utils/authNavigation";

describe("safe authentication redirects", () => {
  it("accepts local paths with query strings and hashes", () => {
    expect(getSafeInternalRedirect("/me/payment/123?tab=receipt#summary"))
      .toBe("/me/payment/123?tab=receipt#summary");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(getSafeInternalRedirect("https://evil.example/path")).toBeNull();
    expect(getSafeInternalRedirect("//evil.example/path")).toBeNull();
  });

  it("rejects missing and non-string redirect values", () => {
    expect(getSafeInternalRedirect(undefined)).toBeNull();
    expect(getSafeInternalRedirect(["/me", "/admin"])).toBeNull();
  });
});
