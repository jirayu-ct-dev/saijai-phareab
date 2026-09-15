export const useMemberStatus = () => {
  const { user } = useUser();
  const userId = computed(() => user.value?.id ?? 'anonymous');
  const { data, status, refresh, error } = useFetch<{ isMember: boolean }>('/api/auth/member-status', {
    // A shared static key can replay the previous user's entitlement after
    // logout/login. Keep the async-data entry scoped to the authenticated user.
    key: () => `member-status:${userId.value}`,
    lazy: true,
    default: () => ({ isMember: false }),
    watch: [userId],
  });

  return {
    isMember: computed(() => userId.value !== 'anonymous' && data.value?.isMember === true),
    loading: computed(() => status.value === 'pending' || status.value === 'idle'),
    refresh,
    error
  };
};
