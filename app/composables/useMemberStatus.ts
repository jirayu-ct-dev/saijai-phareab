export const useMemberStatus = () => {
  const { data, status, refresh, error } = useFetch('/api/auth/member-status', {
    key: 'member-status',
    lazy: true,
    default: () => ({ isMember: false })
  });

  return {
    isMember: computed(() => data.value?.isMember ?? false),
    loading: computed(() => status.value === 'pending' || status.value === 'idle'),
    refresh,
    error
  };
};
