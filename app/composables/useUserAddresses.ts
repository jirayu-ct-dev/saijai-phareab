export const useUserAddresses = () => {
  const { data, status, refresh } = useFetch("/api/me/addresses", {
    key: "my-addresses",
    lazy: true,
  });

  const addAddress = async (payload: any) => {
    return await $fetch("/api/me/addresses", {
      method: "POST",
      body: payload,
    });
  };

  const updateAddress = async (id: string, payload: any) => {
    return await $fetch(`/api/me/addresses/${id}`, {
      method: "PUT",
      body: payload,
    });
  };

  const deleteAddress = async (id: string) => {
    return await $fetch(`/api/me/addresses/${id}`, {
      method: "DELETE",
    });
  };

  return {
    addresses: computed(() => data.value ?? []),
    pending: computed(() => status.value === "pending"),
    refresh,
    addAddress,
    updateAddress,
    deleteAddress,
  };
};
