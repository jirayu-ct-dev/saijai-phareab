import { describe, expect, it } from "vitest";
import { normalizeThaiPhoneNumber } from "../../shared/utils/phone";

describe("normalizeThaiPhoneNumber", () => {
  it.each([
    ["0812345678", "0812345678"],
    ["081-234-5678", "0812345678"],
    ["(081) 234 5678", "0812345678"],
    [" +66 81-234-5678 ", "0812345678"],
    ["081\u00a0234\u00a05678", "0812345678"],
    ["๐๘๑-๒๓๔-๕๖๗๘", "0812345678"],
    ["02-123-4567", "021234567"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeThaiPhoneNumber(input)).toBe(expected);
  });

  it.each([
    "",
    "   ",
    "081-ABC-5678",
    "+1 212 555 0100",
    "+660812345678",
    "812345678",
    "081234567890",
    "081\u202f234\u202f5678",
  ])("rejects unsupported input %s", (input) => {
    expect(normalizeThaiPhoneNumber(input)).toBeNull();
  });
});
