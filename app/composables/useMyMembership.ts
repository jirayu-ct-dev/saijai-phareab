export const useMyMembership = () => {
  const { data, status, refresh, error } = useFetch("/api/me/membership");

  return {
    entitlements: computed(() => data.value ?? []),
    pending: computed(() => status.value === 'pending'),
    refresh,
    error,
  };
};
