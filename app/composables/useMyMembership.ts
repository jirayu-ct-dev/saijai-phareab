export const useMyMembership = () => {
  const { data, status, refresh, error } = useFetch("/api/me/membership", {
    lazy: true,
    default: () => [],
  });

  return {
    entitlements: computed(() => data.value ?? []),
    pending: computed(() => status.value === 'pending' || status.value === 'idle'),
    refresh,
    error,
  };
};
