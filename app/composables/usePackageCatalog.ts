export type PosPackageProduct = {
  id: string;
  name: string;
  description: string | null;
  packageType: "MAIN" | "ADDON";
  isDelivery: boolean;
  price: number;
  credits: number | null;
  validityDays: number | null;
};

export const usePackageCatalog = () => {
  const { data: products, status, refresh } = useFetch<PosPackageProduct[]>("/api/admin/package-catalog", {
    default: () => [],
    server: false,
    lazy: true,
  });

  return {
    products,
    isLoading: computed(() => status.value === "pending" || status.value === "idle"),
    refresh,
  };
};
