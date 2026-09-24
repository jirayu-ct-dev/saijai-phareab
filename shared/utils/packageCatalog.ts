export type PackageCatalogRule = {
  includedItemIds: readonly string[];
};

export type PackageCatalogItem = {
  itemId: string;
};

export const isPackageCatalogItemAllowed = (
  rule: PackageCatalogRule | null | undefined,
  item: PackageCatalogItem,
): boolean => Boolean(
  Boolean(rule?.includedItemIds.includes(item.itemId)),
);
