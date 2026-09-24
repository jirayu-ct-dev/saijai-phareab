import { describe, expect, it } from "vitest";
import { allocatePackageCredits } from "../../shared/utils/packageService";

describe("package credits", () => {
  const items = [
    { id: "iron-shirt", quantity: 3, unitPrice: 20 },
    { id: "wash-shirt", quantity: 2, unitPrice: 40 },
  ];

  it("uses credits only for package-included items, allowing overdraft", () => {
    const result = allocatePackageCredits(items.map((item) => ({ ...item, isPackageIncluded: true })), 4, true);

    expect(result.creditUsed).toBe(5);
    expect(result.cashQuantity).toBe(0);
    expect(result.cashSubtotal).toBe(0);
    expect(result.items.map((item) => [item.id, item.creditQuantity, item.cashQuantity])).toEqual([
      ["iron-shirt", 3, 0],
      ["wash-shirt", 2, 0],
    ]);
  });

  it("charges cash for all items when no package is selected", () => {
    const result = allocatePackageCredits(items, 0, false);

    expect(result.creditUsed).toBe(0);
    expect(result.cashQuantity).toBe(5);
    expect(result.cashSubtotal).toBe(140);
    expect(result.items.map((item) => [item.id, item.creditQuantity, item.cashQuantity])).toEqual([
      ["iron-shirt", 0, 3],
      ["wash-shirt", 0, 2],
    ]);
  });

  it("charges and counts only chargeable extras beside package-covered items", () => {
    const result = allocatePackageCredits([
      { id: "included", quantity: 2, unitPrice: 80, isPackageIncluded: true, isChargeable: false },
      { id: "extra", quantity: 3, unitPrice: 25, isPackageIncluded: false, isChargeable: true },
      { id: "waived", quantity: 1, unitPrice: 15, isPackageIncluded: false, isChargeable: false },
    ], 1, true);

    expect(result.creditUsed).toBe(2);
    expect(result.cashQuantity).toBe(3);
    expect(result.cashSubtotal).toBe(75);
    expect(result.items.map((item) => [item.id, item.creditQuantity, item.cashQuantity])).toEqual([
      ["included", 2, 0],
      ["extra", 0, 3],
      ["waived", 0, 0],
    ]);
  });

  it("never consumes package credits for waived extras", () => {
    const result = allocatePackageCredits([
      { quantity: 2, unitPrice: 10, isPackageIncluded: false, isChargeable: false },
    ], 5, true);

    expect(result.creditUsed).toBe(0);
    expect(result.cashQuantity).toBe(0);
    expect(result.cashSubtotal).toBe(0);
  });
});
