export const useMyReceipts = (defaultPageSize = 10) => {
  const page = ref(1);
  const pageSize = ref(defaultPageSize);

  const { data, status, refresh } = useFetch("/api/me/receipts", {
    key: "my-receipts",
  });

  return {
    receipts: computed(() => data.value?.items ?? []),
    total: computed(() => data.value?.total ?? 0),
    pending: computed(() => status.value === "pending"),
    refresh,
  };
};

