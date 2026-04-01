import type { PaymentMethod, PaymentStatus, PackageSaleStatus } from "~~/shared/types/enums";

export type AdminSaleSlipImage = {
  id: string;
  secureUrl: string | null;
  url: string | null;
};

export type AdminPackageSaleRecord = {
  id: string;
  status: PackageSaleStatus;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string | null;
    email: string;
    phoneNumber: string | null;
    image: string | null;
  };
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    packageType: "MAIN" | "ADDON";
    credits: number | null;
    validityDays: number | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  payment: {
    id: string;
    amount: number;
    paymentMethod: PaymentMethod;
    status: PaymentStatus;
    note: string | null;
    paidAt: string | null;
    verifiedAt: string | null;
    slipImage: AdminSaleSlipImage | null;
  } | null;
};

export type AdminSaleItemInput = {
  productId: string;
  quantity: number;
};

export type CreateAdminSaleBody = {
  customerId: string;
  items: AdminSaleItemInput[];
  paymentMethod: PaymentMethod;
  status?: PaymentStatus;
  note?: string | null;
  slipImageId?: string | null;
};

export type UpdateAdminSaleBody = CreateAdminSaleBody;

export const useAdminSales = () => {
  const notify = useNotify();

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === "object" && "data" in error) {
      const data = (error as { data?: { statusMessage?: string } }).data;
      if (data?.statusMessage) return data.statusMessage;
    }

    return fallback;
  };

  const { data: sales, status, refresh } = useFetch<AdminPackageSaleRecord[]>("/api/admin/package-sales", {
    default: () => [],
  });

  const isLoading = computed(() => status.value === "pending");

  const createSale = async (body: CreateAdminSaleBody): Promise<boolean> => {
    try {
      await $fetch("/api/admin/package-sales", { method: "POST", body });
      await refresh();
      notify.created("รายการขาย");
      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "Unable to create sale"));
      return false;
    }
  };

  const updateSale = async (id: string, body: UpdateAdminSaleBody): Promise<boolean> => {
    try {
      await $fetch(`/api/admin/package-sales/${id}`, { method: "PUT", body });
      await refresh();
      notify.updated("รายการขาย");
      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "Unable to update sale"));
      return false;
    }
  };

  const deleteSale = async (id: string): Promise<boolean> => {
    try {
      await $fetch(`/api/admin/package-sales/${id}`, { method: "DELETE" });
      await refresh();
      notify.deleted("รายการขาย");
      return true;
    } catch (error: unknown) {
      notify.error(getErrorMessage(error, "Unable to delete sale"));
      return false;
    }
  };

  return {
    sales,
    isLoading,
    refresh,
    createSale,
    updateSale,
    deleteSale,
  };
};
