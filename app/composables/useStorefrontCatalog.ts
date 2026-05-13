export type PosStorefrontCatalogItem = {
  id: string;
  price: number;
  priceMin: number | null;
  priceMax: number | null;
  categoryId: string | null;
  categoryName: string | null;
  serviceId: string;
  serviceName: string;
  itemId: string;
  itemName: string;
  label: string;
};

export const useStorefrontCatalog = () => {
  const { data: items, status, refresh } = useFetch<PosStorefrontCatalogItem[]>("/api/admin/storefront-catalog", {
    default: () => [],
    server: false,
    lazy: true,
  });

  return {
    items,
    isLoading: computed(() => status.value === "pending" || status.value === "idle"),
    refresh,
  };
};
