export const useMyPayments = (_defaultPageSize = 10) => {
  const { data, status, refresh } = useFetch("/api/me/payment", {
    key: "my-payments",
    lazy: true,
  });

  return {
    payments: computed(() => data.value?.items ?? []),
    total: computed(() => data.value?.total ?? 0),
    pending: computed(() => status.value === "pending" || status.value === "idle"),
    refresh,
  };
};

export const useMyReceipts = useMyPayments;
