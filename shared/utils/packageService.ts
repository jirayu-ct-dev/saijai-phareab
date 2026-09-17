export type PackageCreditLine = {
  quantity: number;
  unitPrice: number;
};

export type AllocatedPackageCreditLine<T extends PackageCreditLine> = T & {
  creditQuantity: number;
  cashQuantity: number;
};

export const allocatePackageCredits = <T extends PackageCreditLine>(
  items: T[],
  availableCredits: number = 0,
  hasPackage: boolean = true,
): {
  items: Array<AllocatedPackageCreditLine<T>>;
  creditUsed: number;
  cashQuantity: number;
  cashSubtotal: number;
} => {
  if (!hasPackage) {
    const allocatedItems = items.map((item) => {
      const quantity = Math.max(0, Math.floor(item.quantity));
      return {
        ...item,
        creditQuantity: 0,
        cashQuantity: quantity,
      };
    });

    return {
      items: allocatedItems,
      creditUsed: 0,
      cashQuantity: allocatedItems.reduce((sum, item) => sum + item.cashQuantity, 0),
      cashSubtotal: allocatedItems.reduce((sum, item) => sum + item.cashQuantity * item.unitPrice, 0),
    };
  }

  // When a monthly package is selected, all laundry items are covered by package credits
  // (overdraft / negative credit is permitted without charging cash for overflow items).
  const allocatedItems = items.map((item) => {
    const quantity = Math.max(0, Math.floor(item.quantity));
    return {
      ...item,
      creditQuantity: quantity,
      cashQuantity: 0,
    };
  });

  return {
    items: allocatedItems,
    creditUsed: allocatedItems.reduce((sum, item) => sum + item.creditQuantity, 0),
    cashQuantity: 0,
    cashSubtotal: 0,
  };
};
