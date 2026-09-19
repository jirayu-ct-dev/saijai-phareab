import { describe, expect, it } from "vitest";
import { isPackageCatalogItemAllowed } from "../../shared/utils/packageCatalog";

describe("package catalog eligibility", () => {
  const rule = { serviceId: "wash-iron", includedItemIds: ["shirt", "pants"] };

  it("allows only selected clothing items under the package service", () => {
    expect(isPackageCatalogItemAllowed(rule, { serviceId: "wash-iron", itemId: "shirt" })).toBe(true);
    expect(isPackageCatalogItemAllowed(rule, { serviceId: "wash-iron", itemId: "blanket" })).toBe(false);
    expect(isPackageCatalogItemAllowed(rule, { serviceId: "dry-clean", itemId: "shirt" })).toBe(false);
  });

  it("allows nothing when no package is selected", () => {
    expect(isPackageCatalogItemAllowed(null, { serviceId: "wash-iron", itemId: "shirt" })).toBe(false);
  });
});
