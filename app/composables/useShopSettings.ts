export const useShopSettings = () => {
  const { data, refresh, error } = useFetch("/api/public/shop-settings", {
    key: "shop-settings",
    lazy: true,
    default: () => ({ name: "", phone: "", address: "", logoUrl: null, lineQrImageUrl: null })
  });

  return {
    settings: data,
    refresh,
    error,
  };
};
