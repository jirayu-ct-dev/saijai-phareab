export const useMyReceipts = (defaultPageSize = 10) => {
  const page = ref(1);
  const pageSize = ref(defaultPageSize);

  const { data, status, refresh } = useFetch("/api/me/receipts", {
    key: "my-receipts",
    query: computed(() => ({ page: page.value, pageSize: pageSize.value })),
    watch: [page, pageSize],
  });

  return {
    receipts: computed(() => data.value?.items ?? []),
    total: computed(() => data.value?.total ?? 0),
    page,
    pageSize,
    pending: computed(() => status.value === "pending"),
    refresh,
  };
};

