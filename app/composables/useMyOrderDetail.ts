export const useMyOrderDetail = (id: string | Ref<string>) => {
  const orderId = isRef(id) ? id : ref(id);

  const { data: order, status, refresh, error } = useFetch(() => `/api/me/orders/${orderId.value}`, {
    lazy: true,
  });

  return {
    order,
    pending: computed(() => status.value === 'pending' || status.value === 'idle'),
    refresh,
    error,
  };
};
