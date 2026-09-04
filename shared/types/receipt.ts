export type ReceiptPayload = {
  id: string;
  paymentNo: string | null;
  receiptType: "PACKAGE" | "STOREFRONT";
  createdAt: string;
  paidAt: string | null;
  amount: number;
  note: string | null;
  paymentQr?: {
    imageDataUrl: string;
    caption: string;
    amountMinor: number;
    currency: "THB";
    receiverLabel: string;
  } | null;
  vat: {
    rate: number;
    amount: number;
    included: boolean;
    baseAmount: number;
  } | null;
  customer: {
    id: string;
    name: string | null;
    email: string;
    phoneNumber: string | null;
    image: string | null;
  };
  packageSale: {
    id: string;
    status: string;
    note: string | null;
    subtotalAmount: number;
    discountAmount: number;
    totalAmount: number;
    soldBy: {
      id: string;
      name: string | null;
      email: string;
    } | null;
    items: Array<{
      id: string;
      name: string;
      type: "MAIN" | "ADDON";
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
  } | null;
  serviceOrder: {
    id: string;
    orderNo: string | null;
    status: string;
    note: string | null;
    receivedAt: string;
    deliveredAt: string | null;
    dueAt: string | null;
    weightKg: number | null;
    washFoldPricePerKg: number | null;
    subtotalAmount: number;
    discountAmount: number;
    totalAmount: number;
    employee: {
      id: string;
      name: string | null;
      email: string;
    } | null;
    hangerCharge: {
      count: number;
      pricePerUnit: number;
      total: number;
    } | null;
    items: Array<{
      id: string;
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      notes: string | null;
      isPackageIncluded: boolean;
      isWashFold?: boolean;
      weightKg?: number | null;
    }>;
    addonUsages: Array<{
      id: string;
      productName: string;
      credits: number;
      deductOn: "CREATED" | "COMPLETED";
      deductedAt: string | null;
      refundedAt: string | null;
    }>;
    creditUsed: number;
    usageHistory: Array<{
      sessionIndex: number;
      orderId: string;
      orderNo: string | null;
      receivedAt: string;
      quantity: number;
      isCurrent: boolean;
    }>;
    memberEntitlement: {
      id: string;
      productName: string;
      creditInitial: number;
      creditRemaining: number;
      endAt: string | null;
    } | null;
  } | null;
};
