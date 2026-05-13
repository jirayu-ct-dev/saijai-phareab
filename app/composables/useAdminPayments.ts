import type { PaymentMethod, PaymentStatus } from "~~/shared/types/enums";

export type PaymentSlipImage = {
  id: string;
  secureUrl: string | null;
  url: string | null;
};

export type AdminPaymentRecord = {
  id: string;
  paymentNo: string | null;
  receiptNo: string | null;
  quotationNo: string | null;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod | null;
  isVerified: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  confirmedAt: string | null;
  metadata: any | null;
  customer: {
    id: string;
    name: string | null;
    email: string;
    phoneNumber: string | null;
    image: string | null;
  };
  packageSale: {
    memberEntitlementId: string | null;
    packageSaleId: string | null;
    productId: string | null;
    productName: string | null;
    packageType: string | null;
    credits: number | null;
    validityDays: number | null;
    items: Array<{
      id: string;
      productId: string;
      productName: string;
      packageType: string;
      quantity: number;
      totalPrice: number;
    }>;
  };
  serviceOrder: {
    id: string | null;
    orderNo: string | null;
    isWalkIn?: boolean;
    walkInName?: string | null;
    walkInPhone?: string | null;
    itemCount: number;
    creditUsed?: number;
    memberEntitlementId?: string | null;
    memberProductName?: string | null;
  } | null;
  slipImage: PaymentSlipImage | null;
};

export type UpdateAdminPaymentBody = {
  customerId?: string;
  productId?: string;
  amount?: number;
  note?: string | null;
  slipImageId?: string | null;
};

export type UpdateAdminPaymentStateBody = {
  status: PaymentStatus;
  method?: PaymentMethod | null;
  slipImageId?: string | null;
};

export const useAdminPayments = () => {
  const notify = useNotify();

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === "object" && "data" in error) {
      const data = (error as { data?: { statusMessage?: string } }).data;
      if (data?.statusMessage) return data.statusMessage;
    }

    return fallback;
  };

  const { data: payments, pending, status, refresh } = useFetch<AdminPaymentRecord[]>("/api/admin/payments", {
    key: "admin-payments",
    default: () => [],
    server: false,
    lazy: true,
  });

  const isLoading = computed(() => pending.value || status.value === "idle");

  const updatePayment = async (id: string, body: UpdateAdminPaymentBody): Promise<boolean> => {
    try {
      await $fetch(`/api/admin/payments/${id}`, { method: "PUT", body });
      await refresh();
      notify.updated("รายการชำระเงิน");
      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "ไม่สามารถอัปเดตรายการชำระเงินได้"));
      return false;
    }
  };

  const updatePaymentState = async (id: string, body: UpdateAdminPaymentStateBody): Promise<boolean> => {
    try {
      await $fetch(`/api/admin/payments/${id}/state`, { method: "PUT", body });
      await refresh();
      notify.updated("สถานะการชำระเงิน");
      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "ไม่สามารถอัปเดตสถานะการชำระเงินได้"));
      return false;
    }
  };

  const deletePayment = async (id: string): Promise<boolean> => {
    try {
      await $fetch(`/api/admin/payments/${id}`, { method: "DELETE" });
      await refresh();
      notify.deleted("รายการชำระเงิน");
      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "ไม่สามารถลบรายการชำระเงินได้"));
      return false;
    }
  };

  const uploadSlip = async (file: File): Promise<PaymentSlipImage | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      return await $fetch<PaymentSlipImage>("/api/admin/payments/upload", {
        method: "POST",
        body: formData,
      });
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "ไม่สามารถอัปโหลดหลักฐานการชำระเงินได้"));
      return null;
    }
  };

  const cancelPayment = async (id: string, note?: string | null): Promise<boolean> => {
    try {
      await $fetch(`/api/admin/payments/${id}/cancel`, { method: "POST", body: { note: note ?? null } });
      await refresh();
      notify.success("ยกเลิกการชำระเงินแล้ว");
      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "ไม่สามารถยกเลิกการชำระเงินได้"));
      return false;
    }
  };

  return {
    payments,
    isLoading,
    refresh,
    updatePayment,
    updatePaymentState,
    deletePayment,
    uploadSlip,
    cancelPayment,
  };
};
