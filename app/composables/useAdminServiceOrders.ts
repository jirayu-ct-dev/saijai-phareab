import type { PaymentMethod, PaymentStatus } from "~~/shared/types/enums";

export type CreateAdminServiceOrderBody = {
  customerId: string;
  items: Array<{
    storefrontPriceId: string;
    quantity: number;
  }>;
  hangerCount?: number;
  dueAt?: string | null;
  discountAmount?: number;
  paymentMethod: PaymentMethod;
  status?: PaymentStatus;
  note?: string | null;
  slipImageId?: string | null;
};

export type CreateAdminServiceOrderResult = {
  id: string;
  orderNo: string | null;
  paymentId: string;
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

  const createServiceOrder = async (body: CreateAdminServiceOrderBody): Promise<CreateAdminServiceOrderResult | null> => {
    try {
      const result = await $fetch<CreateAdminServiceOrderResult>("/api/admin/service-orders", { method: "POST", body });
      notify.created("เธฃเธฒเธขเธเธฒเธฃเธเธฃเธดเธเธฒเธฃเธซเธเนเธฒเธฃเนเธฒเธ");
      return result;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "Unable to create storefront order"));
      return null;
    }
  };

  return {
    createServiceOrder,
  };
};
