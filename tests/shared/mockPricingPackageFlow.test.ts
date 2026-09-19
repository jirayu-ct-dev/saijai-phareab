import { describe, expect, it } from "vitest";
import {
  mockItemsData,
  mockPackagesData,
  mockPricesData,
  mockServiceIncludedItemsData,
  mockServicesData,
  servicesIdMap,
} from "../../shared/data/mockPricing";

describe("mock package catalog flow", () => {
  it("links every included item to an existing item, service, and price", () => {
    const itemIds = new Set(mockItemsData.map(item => item.id));
    const serviceIds = new Set(mockServicesData.map(service => service.id));
    const priceKeys = new Set(mockPricesData.map(price => `${price.storefrontServiceId}:${price.storefrontItemId}`));

    for (const rule of mockServiceIncludedItemsData) {
      expect(serviceIds.has(rule.storefrontServiceId)).toBe(true);
      expect(itemIds.has(rule.storefrontItemId)).toBe(true);
      expect(priceKeys.has(`${rule.storefrontServiceId}:${rule.storefrontItemId}`)).toBe(true);
    }
  });

  it("demonstrates shared and separate package services", () => {
    const packageS = mockPackagesData.find(pkg => pkg.name === "S");
    const packageM = mockPackagesData.find(pkg => pkg.name === "M");
    const packageL = mockPackagesData.find(pkg => pkg.name === "L");

    expect(packageS?.serviceId).toBe(servicesIdMap.wash_iron);
    expect(packageM?.serviceId).toBe(servicesIdMap.wash_iron);
    expect(packageL?.serviceId).toBe(servicesIdMap.iron);
  });
});
