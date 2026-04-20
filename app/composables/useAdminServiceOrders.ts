import type { PaymentMethod, PaymentStatus, ServiceOrderStatus } from "~~/shared/types/enums";

export type CreateAdminServiceOrderBody = {
  customerId?: string | null;
  isWalkIn?: boolean;
  walkInName?: string | null;
  walkInPhone?: string | null;
  items: Array<{
    storefrontPriceId: string;
    quantity: number;
  }>;
  hangerCount?: number;
  dueAt?: string | null;
  discountAmount?: number;
  paymentMethod: PaymentMethod;
  status?: PaymentStatus;
  serviceOrderStatus?: ServiceOrderStatus;
  note?: string | null;
  slipImageId?: string | null;
};

export type UpdateAdminServiceOrderBody = CreateAdminServiceOrderBody;

export type CreateAdminServiceOrderResult = {
  id: string;
  orderNo: string | null;
  paymentId: string;
};

export type AdminServiceOrder = {
  id: string;
  orderNo: string | null;
  status: ServiceOrderStatus;
  isWalkIn: boolean;
  walkInName: string | null;
  walkInPhone: string | null;
  note: string | null;
  receivedAt: string;
  dueAt: string | null;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  hangerCharge: {
    count: number;
    pricePerUnit: number;
    total: number;
  } | null;
  customer: {
    id: string;
    name: string | null;
    email: string;
    phoneNumber: string | null;
    image: string | null;
  };
  employee: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  items: Array<{
    id: string;
    storefrontPriceId: string;
    label: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes: string | null;
  }>;
  payment: {
    id: string | null;
    paymentNo: string | null;
    paymentMethod: PaymentMethod;
    status: PaymentStatus;
    amount: number;
    paidAt: string | null;
    slipImage: {
      id: string;
      secureUrl: string | null;
      url: string | null;
    } | null;
  } | null;
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

  const { data: serviceOrders, status, refresh } = useFetch<AdminServiceOrder[]>("/api/admin/service-orders", {
    key: "admin-service-orders",
    default: () => [],
  });

  const isLoading = computed(() => status.value === "pending");

  const createServiceOrder = async (body: CreateAdminServiceOrderBody): Promise<CreateAdminServiceOrderResult | null> => {
    try {
      const result = await $fetch<CreateAdminServiceOrderResult>("/api/admin/service-orders", { method: "POST", body });
      await refresh();
      notify.created("รายการรับผ้า");
      return result;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "ไม่สามารถสร้างรายการรับผ้าได้"));
      return null;
    }
  };

  const updateServiceOrder = async (id: string, body: UpdateAdminServiceOrderBody): Promise<boolean> => {
    try {
      await $fetch(`/api/admin/service-orders/${id}`, { method: "PUT", body });
      await refresh();
      notify.updated("รายการรับผ้า");
      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "ไม่สามารถอัปเดตรายการรับผ้าได้"));
      return false;
    }
  };

  const deleteServiceOrder = async (id: string): Promise<boolean> => {
    try {
      await $fetch(`/api/admin/service-orders/${id}`, { method: "DELETE" });
      await refresh();
      notify.deleted("รายการรับผ้า");
      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "ไม่สามารถลบรายการรับผ้าได้"));
      return false;
    }
  };

  return {
    serviceOrders,
    isLoading,
    refresh,
    createServiceOrder,
    updateServiceOrder,
    deleteServiceOrder,
  };
};
