type ShopSetting = {
  id: string;
  name: string;
  phone: string;
  address: string;
  logoUrl: string | null;
  lineQrImageUrl: string | null;
  updatedAt: string;
};

type UpdateInput = Omit<ShopSetting, "id" | "updatedAt">;

export const useAdminShopSettings = () => {
  const notify = useNotify();

  const { data, status, refresh } = useFetch<ShopSetting>("/api/admin/settings/shop", {
    key: "admin-shop-settings",
  });
  const isLoading = computed(() => status.value === "pending");

  const updateSettings = async (body: UpdateInput) => {
    try {
      await $fetch("/api/admin/settings/shop", { method: "PUT", body });
      await refresh();
      notify.updated();
    } catch {
      notify.serverError();
    }
  };

  return { settings: data, isLoading, updateSettings };
};
