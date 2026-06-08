export const useMyMembershipUsage = (id: string | Ref<string>) => {
  const entitlementId = isRef(id) ? id : ref(id);

  const { data, status, refresh, error } = useFetch(() => `/api/me/membership/${entitlementId.value}/usage`, {
    lazy: true,
  });

  return {
    entitlement: computed(() => data.value?.entitlement ?? null),
    usages: computed(() => data.value?.usages ?? []),
    pending: computed(() => status.value === 'pending' || status.value === 'idle'),
    refresh,
    error,
  };
};
