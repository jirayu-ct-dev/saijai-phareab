import { describe, expect, it } from "vitest";
import { allocatePackageCredits } from "../../shared/utils/packageService";

describe("package credits", () => {
  const items = [
    { id: "iron-shirt", serviceId: "iron", quantity: 3, unitPrice: 20 },
    { id: "wash-shirt", serviceId: "wash", quantity: 2, unitPrice: 40 },
  ];

  it("covers all items with credit when a package is selected, allowing overdraft", () => {
    const result = allocatePackageCredits(items, 4, true);

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
});
