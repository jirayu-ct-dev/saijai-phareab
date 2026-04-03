import type { PaymentMethod, PaymentStatus } from "~~/shared/types/enums";

export type CreateAdminServiceOrderBody = {
  customerId: string;
  items: Array<{
    storefrontPriceId: string;
    quantity: number;
  }>;
  hangerCount?: number;
  paymentMethod: PaymentMethod;
  status?: PaymentStatus;
  note?: string | null;
  slipImageId?: string | null;
};

export const useAdminServiceOrders = () => {
  const notify = useNotify();

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === "object" && "data" in error) {
      const data = (error as { data?: { statusMessage?: string } }).data;
      if (data?.statusMessage) return data.statusMessage;
    }

    return fallback;
  };

  const createServiceOrder = async (body: CreateAdminServiceOrderBody): Promise<boolean> => {
    try {
      await $fetch("/api/admin/service-orders", { method: "POST", body });
      notify.created("รายการบริการหน้าร้าน");
      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "Unable to create storefront order"));
      return false;
    }
  };

  return {
    createServiceOrder,
  };
};
