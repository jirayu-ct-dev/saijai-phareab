import { describe, expect, it } from "vitest";
import { allocatePackageCredits } from "../../shared/utils/packageService";

describe("package credits", () => {
  const items = [
    { id: "iron-shirt", serviceId: "iron", quantity: 3, unitPrice: 20 },
    { id: "wash-shirt", serviceId: "wash", quantity: 2, unitPrice: 40 },
  ];

  it("uses available credits across services in item order", () => {
    const result = allocatePackageCredits(items, 4);

    expect(result.creditUsed).toBe(4);
    expect(result.cashQuantity).toBe(1);
    expect(result.cashSubtotal).toBe(40);
    expect(result.items.map((item) => [item.id, item.creditQuantity, item.cashQuantity])).toEqual([
      ["iron-shirt", 3, 0],
      ["wash-shirt", 1, 1],
    ]);
  });
});
