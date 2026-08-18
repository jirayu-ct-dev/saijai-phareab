export type PosCustomerOption = {
  id: string;
  label: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  customerAccountStatus?: "OFFLINE" | "ACTIVE";
  image?: string | null;
  activeMemberEntitlement?: {
    id: string;
    productId: string;
    productName: string;
    creditInitial: number | null;
    creditRemaining: number | null;
    endAt: string | null;
  } | null;
  addonEntitlements?: Array<{
    id: string;
    productId: string;
    productName: string;
    creditInitial: number | null;
    creditRemaining: number | null;
    endAt: string | null;
    deductOn: "CREATED" | "COMPLETED";
    isDelivery: boolean;
  }>;
};

export const useAdminCustomerOptions = () => {
  const searchQuery = ref("");
  const debouncedSearchQuery = refDebounced(searchQuery, 250);
  const { data: customers, status, refresh } = useFetch<PosCustomerOption[]>("/api/admin/customer-options", {
    query: { q: debouncedSearchQuery, limit: 50 },
    default: () => [],
  });

  return {
    customers,
    isLoading: computed(() => status.value === "pending"),
    refresh,
    setSearch: (value: string) => { searchQuery.value = value; },
  };
};

export const isInternalCustomerEmail = (email?: string | null) =>
  Boolean(email?.toLowerCase().endsWith("@saijai.local"));

export const customerEmailLabel = (email?: string | null) =>
  email && !isInternalCustomerEmail(email) ? email : "ยังไม่ได้ระบุอีเมล";
