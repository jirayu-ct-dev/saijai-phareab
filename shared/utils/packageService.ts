export type PackageCreditLine = {
  quantity: number;
  unitPrice: number;
  isPackageIncluded?: boolean;
  isChargeable?: boolean;
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
  const allocatedItems = items.map((item) => {
    const quantity = Math.max(0, Math.floor(item.quantity));
    const creditQuantity = hasPackage && item.isPackageIncluded ? quantity : 0;
    const cashQuantity = item.isChargeable === false ? 0 : quantity;
    return {
      ...item,
      creditQuantity,
      cashQuantity: creditQuantity > 0 ? 0 : cashQuantity,
    };
  });

  return {
    items: allocatedItems,
    creditUsed: allocatedItems.reduce((sum, item) => sum + item.creditQuantity, 0),
    cashQuantity: allocatedItems.reduce((sum, item) => sum + item.cashQuantity, 0),
    cashSubtotal: allocatedItems.reduce((sum, item) => sum + item.cashQuantity * item.unitPrice, 0),
  };
};
