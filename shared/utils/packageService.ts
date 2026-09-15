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
  availableCredits: number,
): {
  items: Array<AllocatedPackageCreditLine<T>>;
  creditUsed: number;
  cashQuantity: number;
  cashSubtotal: number;
} => {
  let remainingCredits = Math.max(0, Math.floor(availableCredits));

  const allocatedItems = items.map((item) => {
    const creditQuantity = Math.min(Math.max(0, Math.floor(item.quantity)), remainingCredits);
    remainingCredits -= creditQuantity;

    return {
      ...item,
      creditQuantity,
      cashQuantity: item.quantity - creditQuantity,
    };
  });

  return {
    items: allocatedItems,
    creditUsed: Math.max(0, Math.floor(availableCredits)) - remainingCredits,
    cashQuantity: allocatedItems.reduce((sum, item) => sum + item.cashQuantity, 0),
    cashSubtotal: allocatedItems.reduce((sum, item) => sum + item.cashQuantity * item.unitPrice, 0),
  };
};
