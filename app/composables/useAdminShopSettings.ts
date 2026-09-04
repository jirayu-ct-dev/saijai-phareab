type ShopSetting = {
  id: string;
  name: string;
  phone: string;
  address: string;
  logoUrl: string | null;
  lineQrImageUrl: string | null;
  lineQrEnabled: boolean;
  updatedAt: string;
};

type UpdateInput = Omit<ShopSetting, "id" | "updatedAt" | "logoUrl" | "lineQrEnabled"> & {
  logoUrl?: string | null;
};

export type AdminPaymentQrSetting = {
  enabled: boolean;
  configured: boolean;
  receiverType: "MOBILE";
  receiverLast4: string | null;
  receiverLabel: string | null;
  activatedAt: string | null;
  configVersion: number;
};

export type UpdatePaymentQrInput = {
  enabled: boolean;
  receiverValue: string | null;
  receiverLabel: string;
};

export const useAdminShopSettings = () => {
  const notify = useNotify();

  const { data, status, refresh } = useFetch<ShopSetting>("/api/admin/settings/shop", {
    key: "admin-shop-settings",
    lazy: true,
  });
  const isLoading = computed(() => status.value === "pending");
  const {
    data: paymentQrSettings,
    status: paymentQrStatus,
    refresh: refreshPaymentQr,
  } = useFetch<AdminPaymentQrSetting>("/api/admin/settings/payment-qr", {
    key: "admin-payment-qr-settings",
    lazy: true,
  });
  const isPaymentQrLoading = computed(() => paymentQrStatus.value === "pending");

  const updateSettings = async (body: UpdateInput) => {
    try {
      await $fetch("/api/admin/settings/shop", { method: "PUT", body });
      await refresh();
      notify.updated();
    } catch {
      notify.serverError();
    }
  };

  const updatePaymentQr = async (body: UpdatePaymentQrInput) => {
    const result = await $fetch<AdminPaymentQrSetting>("/api/admin/settings/payment-qr", {
      method: "PUT",
      body,
    });
    paymentQrSettings.value = result;
    await refreshPaymentQr();
    notify.updated();
    return result;
  };

  return {
    settings: data,
    isLoading,
    updateSettings,
    paymentQrSettings,
    isPaymentQrLoading,
    updatePaymentQr,
  };
};
