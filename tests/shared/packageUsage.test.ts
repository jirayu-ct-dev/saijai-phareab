import { describe, expect, it } from "vitest";
import {
  hasUsablePackageCredits,
  normalizePackageUsageSettings,
} from "../../shared/utils/packageUsage";

describe("package usage settings", () => {
  it("uses credits immediately for main and regular add-on packages", () => {
    expect(normalizePackageUsageSettings({ packageType: "MAIN", isDelivery: true, credits: 30 })).toEqual({
      isDelivery: false,
      deductOn: "CREATED",
      credits: 30,
    });
    expect(normalizePackageUsageSettings({ packageType: "ADDON", credits: 10 })).toEqual({
      isDelivery: false,
      deductOn: "CREATED",
      credits: 10,
    });
  });

  it("records delivery usage without credits", () => {
    expect(normalizePackageUsageSettings({ packageType: "ADDON", isDelivery: true, credits: 8 })).toEqual({
      isDelivery: true,
      deductOn: "CREATED",
      credits: null,
    });
  });

  it("requires positive whole credits except for delivery packages", () => {
    expect(hasUsablePackageCredits(normalizePackageUsageSettings({ packageType: "MAIN", credits: 1 }))).toBe(true);
    expect(hasUsablePackageCredits(normalizePackageUsageSettings({ packageType: "ADDON", credits: 0 }))).toBe(false);
    expect(hasUsablePackageCredits(normalizePackageUsageSettings({ packageType: "ADDON", credits: 1.5 }))).toBe(false);
    expect(hasUsablePackageCredits(normalizePackageUsageSettings({ packageType: "ADDON", isDelivery: true }))).toBe(true);
  });
});
