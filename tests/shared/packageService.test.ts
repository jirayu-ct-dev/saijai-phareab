import { describe, expect, it } from "vitest";
import { allocatePackageCredits } from "../../shared/utils/packageService";

describe("service-scoped package credits", () => {
  const items = [
    { id: "iron-shirt", serviceId: "iron", quantity: 3, unitPrice: 20 },
    { id: "wash-shirt", serviceId: "wash", quantity: 2, unitPrice: 40 },
  ];

  it("uses credits only for the service assigned to the package", () => {
    const result = allocatePackageCredits(items, 4, "iron");

    expect(result.creditUsed).toBe(3);
    expect(result.cashQuantity).toBe(2);
    expect(result.cashSubtotal).toBe(80);
    expect(result.items.map((item) => [item.id, item.creditQuantity, item.cashQuantity])).toEqual([
      ["iron-shirt", 3, 0],
      ["wash-shirt", 0, 2],
    ]);
  });

  it("keeps legacy packages without a service usable for every service", () => {
    const result = allocatePackageCredits(items, 4, null);

    expect(result.creditUsed).toBe(4);
    expect(result.cashQuantity).toBe(1);
    expect(result.cashSubtotal).toBe(40);
  });
});
