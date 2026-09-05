import type { ServiceOrderStatus } from "~~/shared/types/enums";
import type { BackdatedOrderInput } from "~~/shared/utils/backdatedOrder";

export type CreateAdminServiceOrderBody = {
  backdated?: BackdatedOrderInput;
  customerId?: string | null;
  newCustomer?: {
    name: string;
    phoneNumber: string;
    email?: string | null;
  };
  memberEntitlementId?: string | null;
  addonEntitlements?: Array<{ entitlementId: string; credits: number }>;
  orderImageId?: string | null;
  deliveryImageId?: string | null;
  items?: Array<{
    storefrontPriceId: string;
    quantity: number;
    unitPrice?: number | null;
    imageId?: string | null;
    notes?: string | null;
    photos?: Array<{ imageId: string; isDamaged: boolean; sortOrder?: number }>;
  }>;
  washFold?: {
    weightKg: number;
    notes?: string | null;
  } | null;
  hangerCount?: number;
  missingHangerCount?: number;
  dueAt?: string | null;
  discountAmount?: number;
  serviceOrderStatus?: ServiceOrderStatus;
  note?: string | null;
  slipImageId?: string | null;
};

export type UpdateAdminServiceOrderBody = CreateAdminServiceOrderBody;

export type UpdateAdminServiceOrderStatusBody = {
  status: ServiceOrderStatus;
};

export type CreateAdminServiceOrderResult = {
  id: string;
  orderNo: string | null;
  paymentId: string;
  activationToken?: string | null;
};

export type AdminServiceOrder = {
  id: string;
  orderNo: string | null;
  status: ServiceOrderStatus;
  backdated?: boolean;
  creditUsed: number | null;
  addonUsages?: Array<{
    id?: string;
    entitlementId: string | null;
    productId: string | null;
    productName: string | null;
    credits: number;
    deductOn: "CREATED" | "COMPLETED";
    isDelivery?: boolean;
    deductedAt: string | null;
    refundedAt: string | null;
  }>;
  note: string | null;
  receivedAt: string;
  dueAt: string | null;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  weightKg: number | null;
  washFoldPricePerKgSnapshot: number | null;
  image: {
    id: string;
    secureUrl: string | null;
    url: string | null;
  } | null;
  deliveryImage: {
    id: string;
    secureUrl: string | null;
    url: string | null;
  } | null;
  memberEntitlement: {
    id: string;
    status: string;
    creditInitial: number | null;
    creditRemaining: number | null;
    endAt: string | null;
    product: {
      id: string;
      name: string;
      packageType: string;
      credits: number | null;
      validityDays: number | null;
    };
  } | null;
  activeEntitlements?: Array<{
    id: string;
    status: string;
    creditInitial: number | null;
    creditRemaining: number | null;
    endAt: string | null;
    product: {
      id: string;
      name: string;
      packageType: string;
      credits: number | null;
      validityDays: number | null;
      deductOn?: "CREATED" | "COMPLETED";
      isDelivery?: boolean;
    };
  }>;
  hangerCharge: {
    count: number;
    pricePerUnit: number;
    total: number;
  } | null;
  customer: {
    id: string;
    name: string | null;
    email: string | null;
    phoneNumber: string | null;
    image: string | null;
    customerAccountStatus?: "OFFLINE" | "ACTIVE";
  };
  employee: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  items: Array<{
    id: string;
    storefrontPriceId: string | null;
    label: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes: string | null;
    isPackageIncluded: boolean;
    weightKg?: number | null;
    weightLabel?: string | null;
    image: {
      id: string;
      secureUrl: string | null;
      url: string | null;
    } | null;
    photos: Array<{
      id: string;
      imageId: string;
      isDamaged: boolean;
      sortOrder: number;
      secureUrl: string | null;
      url: string | null;
    }>;
  }>;
  payment: {
    id: string | null;
    paymentNo: string | null;
    amount: number;
    status: import("~~/shared/types/enums").PaymentStatus;
    method: import("~~/shared/types/enums").PaymentMethod | null;
    paidAt: string | null;
    slipImage: {
      id: string;
      secureUrl: string | null;
      url: string | null;
    } | null;
  } | null;
};

export type AdminServiceOrderImage = {
  id: string;
  secureUrl: string | null;
  url: string | null;
};

type UseAdminServiceOrdersOptions = {
  fetchList?: boolean;
  refreshAfterMutation?: boolean;
};

export const useAdminServiceOrders = (options: UseAdminServiceOrdersOptions = {}) => {
  const notify = useNotify();
  const fetchList = options.fetchList ?? true;
  const refreshAfterMutation = options.refreshAfterMutation ?? fetchList;

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === "object" && "data" in error) {
      const data = (error as { data?: { statusMessage?: string } }).data;
      if (data?.statusMessage) return data.statusMessage;
    }

    return fallback;
  };

  const { data: serviceOrders, pending, status, refresh } = useFetch<AdminServiceOrder[]>("/api/admin/service-orders", {
    key: "admin-service-orders",
    default: () => [],
    immediate: fetchList,
    server: false,
    lazy: true,
  });

  const isLoading = computed(() => pending.value || status.value === "idle");

  const createServiceOrder = async (body: CreateAdminServiceOrderBody): Promise<CreateAdminServiceOrderResult | null> => {
    try {
      const result = await $fetch<CreateAdminServiceOrderResult>("/api/admin/service-orders", { method: "POST", body });
      if (refreshAfterMutation) await refresh();
      notify.created("รายการรับผ้า");
      return result;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "ไม่สามารถสร้างรายการรับผ้าได้"));
      return null;
    }
  };

  const createServiceOrderOrThrow = async (body: CreateAdminServiceOrderBody): Promise<CreateAdminServiceOrderResult> => {
    const result = await $fetch<CreateAdminServiceOrderResult>("/api/admin/service-orders", { method: "POST", body });
    if (refreshAfterMutation) await refresh();
    notify.created("รายการรับผ้า");
    return result;
  };

  const updateServiceOrder = async (id: string, body: UpdateAdminServiceOrderBody): Promise<boolean> => {
    try {
      await $fetch(`/api/admin/service-orders/${id}`, { method: "PUT", body });
      if (refreshAfterMutation) await refresh();
      notify.updated("รายการรับผ้า");
      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "ไม่สามารถอัปเดตรายการรับผ้าได้"));
      return false;
    }
  };

  const updateServiceOrderStatus = async (id: string, body: UpdateAdminServiceOrderStatusBody): Promise<boolean> => {
    try {
      await $fetch(`/api/admin/service-orders/${id}/status`, { method: "PATCH", body });
      if (refreshAfterMutation) await refresh();
      notify.updated("สถานะรายการรับผ้า");
      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "ไม่สามารถอัปเดตสถานะรายการรับผ้าได้"));
      return false;
    }
  };

  const deleteServiceOrder = async (id: string): Promise<boolean> => {
    try {
      await $fetch(`/api/admin/service-orders/${id}`, { method: "DELETE" });
      if (refreshAfterMutation) await refresh();
      notify.deleted("รายการรับผ้า");
      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "ไม่สามารถลบรายการรับผ้าได้"));
      return false;
    }
  };

  const uploadOrderImage = async (file: File): Promise<AdminServiceOrderImage | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      return await $fetch<AdminServiceOrderImage>("/api/admin/service-orders/upload", {
        method: "POST",
        body: formData,
      });
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "ไม่สามารถอัปโหลดรูปรายการได้"));
      return null;
    }
  };

  return {
    serviceOrders,
    isLoading,
    refresh,
    createServiceOrder,
    createServiceOrderOrThrow,
    updateServiceOrder,
    updateServiceOrderStatus,
    deleteServiceOrder,
    uploadOrderImage,
  };
};
