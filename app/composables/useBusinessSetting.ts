type BusinessSetting = {
  id: string;
  hangerPricePerUnit: number;
  vatRate: number;
  vatIncluded: boolean;
  paymentNoPrefix: string;
  orderNoPrefix: string;
  minimumOrderAmount: number;
  packageRefundDays: number;
  updatedAt: string;
};

const FALLBACK: Omit<BusinessSetting, "id" | "updatedAt"> = {
  hangerPricePerUnit: 10,
  vatRate: 0,
  vatIncluded: false,
  paymentNoPrefix: "PAY-",
  orderNoPrefix: "ORD-",
  minimumOrderAmount: 0,
  packageRefundDays: 7,
};

export const useBusinessSetting = () => {
  const { data, status, refresh } = useFetch<BusinessSetting>("/api/admin/settings/business", {
    key: "admin-business-setting",
  });

  const isLoading = computed(() => status.value === "pending");

  const hangerPricePerUnit = computed(() => data.value?.hangerPricePerUnit ?? FALLBACK.hangerPricePerUnit);
  const vatRate = computed(() => data.value?.vatRate ?? FALLBACK.vatRate);
  const vatIncluded = computed(() => data.value?.vatIncluded ?? FALLBACK.vatIncluded);

  const computeVatPreview = (amount: number) => {
    const rate = vatRate.value;
    const included = vatIncluded.value;
    if (rate <= 0 || amount <= 0) {
      return { baseAmount: amount, vatAmount: 0, totalAmount: amount, rate, included };
    }
    if (included) {
      const totalAmount = amount;
      const baseAmount = totalAmount / (1 + rate / 100);
      return { baseAmount, vatAmount: totalAmount - baseAmount, totalAmount, rate, included };
    }
    const vatAmount = amount * (rate / 100);
    return { baseAmount: amount, vatAmount, totalAmount: amount + vatAmount, rate, included };
  };

  const updateSettings = async (body: Omit<BusinessSetting, "id" | "updatedAt">) => {
    const notify = useNotify();
    try {
      await $fetch("/api/admin/settings/business", { method: "PUT", body });
      await refresh();
      notify.updated();
    } catch {
      notify.serverError();
    }
  };

  return { settings: data, isLoading, refresh, hangerPricePerUnit, vatRate, vatIncluded, computeVatPreview, updateSettings };
};
