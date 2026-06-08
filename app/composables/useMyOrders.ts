export const useMyOrders = () => {
  const page = ref(1);
  const pageSize = ref(10);
  const status = ref<string>("ALL");

  const query = computed(() => {
    const q: any = { page: page.value, pageSize: pageSize.value };
    if (status.value && status.value !== "ALL") q.status = status.value;
    return q;
  });

  const { data, status: requestStatus, refresh, error } = useFetch("/api/me/orders", {
    key: "me-orders",
    query,
    watch: [query],
  });

  return {
    orders: computed(() => data.value?.data ?? []),
    meta: computed(() => data.value?.meta ?? { page: 1, pageSize: 10, total: 0, pageCount: 0 }),
    page,
    pageSize,
    status,
    pending: computed(() => requestStatus.value === 'pending'),
    refresh,
    error,
  };
};
