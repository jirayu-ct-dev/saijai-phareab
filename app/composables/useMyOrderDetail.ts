export const useMyOrderDetail = (id: string | Ref<string>) => {
  const orderId = isRef(id) ? id : ref(id);

  const { data: order, status, refresh, error } = useFetch(() => `/api/me/orders/${orderId.value}`);

  return {
    order,
    pending: computed(() => status.value === 'pending'),
    refresh,
    error,
  };
};
