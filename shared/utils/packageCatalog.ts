export type PackageCatalogRule = {
  serviceId: string | null;
  includedItemIds: readonly string[];
};

export type PackageCatalogItem = {
  serviceId: string;
  itemId: string;
};

export const isPackageCatalogItemAllowed = (
  rule: PackageCatalogRule | null | undefined,
  item: PackageCatalogItem,
): boolean => Boolean(
  rule?.serviceId
  && item.serviceId === rule.serviceId
  && rule.includedItemIds.includes(item.itemId),
);
