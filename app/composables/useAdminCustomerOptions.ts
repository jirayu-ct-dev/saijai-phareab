export type PosCustomerOption = {
  id: string;
  label: string;
  name: string | null;
  email: string;
  phoneNumber: string | null;
  image?: string | null;
  activeMemberEntitlement?: {
    id: string;
    productName: string;
    creditInitial: number | null;
    creditRemaining: number | null;
    endAt: string | null;
  } | null;
};

export const useAdminCustomerOptions = () => {
  const { data: customers, status, refresh } = useFetch<PosCustomerOption[]>("/api/admin/customer-options", {
    default: () => [],
  });

  return {
    customers,
    isLoading: computed(() => status.value === "pending"),
    refresh,
  };
};
