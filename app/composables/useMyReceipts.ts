export const useMyReceipts = () => {
  const { data, status, refresh, error } = useFetch("/api/me/receipts");

  return {
    receipts: computed(() => data.value ?? []),
    pending: computed(() => status.value === 'pending'),
    refresh,
    error,
  };
};
