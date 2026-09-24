import { describe, expect, it } from "vitest";
import { isPackageCatalogItemAllowed } from "../../shared/utils/packageCatalog";

describe("package catalog eligibility", () => {
  const rule = { includedItemIds: ["shirt", "pants"] };

  it("allows included clothing independently of the storefront service selected for extras", () => {
    expect(isPackageCatalogItemAllowed(rule, { itemId: "shirt" })).toBe(true);
    expect(isPackageCatalogItemAllowed(rule, { itemId: "blanket" })).toBe(false);
  });

  it("allows nothing when no package is selected", () => {
    expect(isPackageCatalogItemAllowed(null, { itemId: "shirt" })).toBe(false);
  });
});
