import type { PaymentMethod } from "~~/shared/types/enums";

export type PaymentSlipImage = {
  id: string;
  secureUrl: string | null;
  url: string | null;
};

export type AdminPaymentRecord = {
  id: string;
  paymentNo: string | null;
  amount: number;

  paymentMethod: PaymentMethod;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  verifiedAt: string | null;
  paidAt: string | null;
  metadata: any | null;
  rejectionReason: string | null;
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
  paymentMethod?: PaymentMethod;

  note?: string | null;
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

  const { data: payments, status, refresh } = useFetch<AdminPaymentRecord[]>("/api/admin/payments", {
    key: "admin-payments",
    default: () => [],
  });

  const isLoading = computed(() => status.value === "pending");

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

  return {
    payments,
    isLoading,
    refresh,
    updatePayment,
    deletePayment,
    uploadSlip,
  };
};
