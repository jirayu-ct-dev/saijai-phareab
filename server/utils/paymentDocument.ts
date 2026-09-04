import { prisma } from "./prisma";
import { isInternalCustomerEmail } from "./customerAccount";
import { packageSaleStatusByPaymentStatus } from "./paymentStateTransition";

const toNumber = (value: unknown) => Number(value ?? 0);

export const buildPaymentDocumentPayload = async (paymentId: string) => {
  const payment = await prisma.paymentRecord.findFirst({
    where: { id: paymentId, deletedAt: null },
    include: {
      user: { select: { id: true, name: true, email: true, phoneNumber: true, image: true } },
      slipImage: { select: { id: true, url: true, secureUrl: true } },
      confirmedBy: { select: { id: true, name: true, email: true } },
      packageSale: {
        include: {
          soldBy: { select: { id: true, name: true, email: true } },
          items: {
            include: { product: { select: { id: true, name: true, packageType: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      serviceOrder: {
        include: {
          employee: { select: { id: true, name: true, email: true } },
          memberEntitlement: {
            select: {
              id: true,
              creditInitial: true,
              creditRemaining: true,
              endAt: true,
              product: { select: { id: true, name: true } },
            },
          },
          serviceOrderItems: {
            include: {
              storefrontPrice: {
                include: {
                  storefrontService: { select: { id: true, name: true } },
                  storefrontItem: { select: { id: true, name: true } },
                },
              },
            },
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
          },
          addonUsageRecords: {
            where: { refundedAt: null },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!payment) return null;

  const usageHistory = payment.serviceOrder?.memberEntitlementId
    ? await prisma.serviceOrder.findMany({
        where: { memberEntitlementId: payment.serviceOrder.memberEntitlementId, deletedAt: null },
        orderBy: { receivedAt: "asc" },
        select: {
          id: true,
          orderNo: true,
          receivedAt: true,
          serviceOrderItems: {
            where: { deletedAt: null, isPackageIncluded: true },
            select: { quantity: true },
          },
        },
      })
    : [];

  const packageItems = payment.packageSale?.items.map((item) => ({
    id: item.id,
    name: item.product.name,
    type: item.product.packageType,
    quantity: item.qty,
    unitPrice: toNumber(item.unitPrice),
    totalPrice: toNumber(item.totalPrice),
  })) ?? [];

  const isWashFoldOrder = payment.serviceOrder?.weightKg != null;
  const serviceItems = payment.serviceOrder?.serviceOrderItems.map((item) => ({
    id: item.id,
    name: `${item.storefrontPrice?.storefrontService.name ?? ""} ${item.storefrontPrice?.storefrontItem.name ?? ""}`.trim(),
    quantity: item.quantity,
    unitPrice: toNumber(item.unitPrice),
    totalPrice: toNumber(item.totalPrice),
    notes: item.notes,
    isPackageIncluded: item.isPackageIncluded,
    isWashFold: isWashFoldOrder,
    weightKg: null as number | null,
  })) ?? [];

  const addonUsages = payment.serviceOrder?.addonUsageRecords.map((usage) => ({
    id: usage.id,
    productName: usage.productName || "แพ็กเกจเสริม",
    credits: usage.credits,
    deductOn: usage.deductOn,
    deductedAt: usage.deductedAt?.toISOString() ?? null,
    refundedAt: usage.refundedAt?.toISOString() ?? null,
  })) ?? [];

  const hangerChargeSource = (payment.serviceOrder?.hangerCharge ?? null) as
    | { count?: number; pricePerUnit?: number; total?: number }
    | null;

  return {
    id: payment.id,
    paymentNo: payment.paymentNo,
    receiptNo: payment.receiptNo,
    quotationNo: payment.serviceOrder?.quotationNo ?? null,
    status: payment.status,
    method: payment.method,
    receiptType: payment.packageSaleId ? ("PACKAGE" as const) : ("STOREFRONT" as const),
    createdAt: payment.createdAt.toISOString(),
    paidAt: payment.paidAt?.toISOString() ?? null,
    confirmedAt: payment.confirmedAt?.toISOString() ?? null,
    confirmedBy: payment.confirmedBy
      ? { id: payment.confirmedBy.id, name: payment.confirmedBy.name, email: payment.confirmedBy.email }
      : null,
    amount: toNumber(payment.amount),
    note: payment.note,
    vat: (() => {
      const meta = (payment.metadata ?? null) as { vat?: { rate?: number; amount?: number; included?: boolean; baseAmount?: number } } | null;
      const v = meta?.vat;
      if (!v || !Number.isFinite(Number(v.rate)) || Number(v.rate) <= 0) return null;
      return {
        rate: Number(v.rate),
        amount: Number(v.amount ?? 0),
        included: Boolean(v.included),
        baseAmount: Number(v.baseAmount ?? 0),
      };
    })(),
    slipImage: payment.slipImage
      ? { id: payment.slipImage.id, url: payment.slipImage.url, secureUrl: payment.slipImage.secureUrl }
      : null,
    customer: {
      id: payment.user.id,
      name: payment.user.name,
      email: isInternalCustomerEmail(payment.user.email) ? null : payment.user.email,
      phoneNumber: payment.user.phoneNumber,
      image: payment.user.image,
    },
    packageSale: payment.packageSale
      ? {
          id: payment.packageSale.id,
          status: packageSaleStatusByPaymentStatus[payment.status],
          note: payment.packageSale.note,
          subtotalAmount: toNumber(payment.packageSale.subtotalAmount),
          discountAmount: toNumber(payment.packageSale.discountAmount),
          totalAmount: toNumber(payment.packageSale.totalAmount),
          soldBy: payment.packageSale.soldBy
            ? { id: payment.packageSale.soldBy.id, name: payment.packageSale.soldBy.name, email: payment.packageSale.soldBy.email }
            : null,
          items: packageItems,
        }
      : null,
    serviceOrder: payment.serviceOrder
      ? {
          id: payment.serviceOrder.id,
          orderNo: payment.serviceOrder.orderNo,
          quotationNo: payment.serviceOrder.quotationNo,
          status: payment.serviceOrder.status,
          note: payment.serviceOrder.note,
          receivedAt: payment.serviceOrder.receivedAt.toISOString(),
          deliveredAt: payment.serviceOrder.status === "COMPLETED"
            ? payment.serviceOrder.updatedAt.toISOString()
            : null,
          dueAt: payment.serviceOrder.dueAt?.toISOString() ?? null,
          subtotalAmount: toNumber(payment.serviceOrder.subtotalAmount),
          weightKg: payment.serviceOrder.weightKg != null ? toNumber(payment.serviceOrder.weightKg) : null,
          washFoldPricePerKg: payment.serviceOrder.washFoldPricePerKgSnapshot != null
            ? toNumber(payment.serviceOrder.washFoldPricePerKgSnapshot)
            : null,
          discountAmount: toNumber(payment.serviceOrder.discountAmount),
          totalAmount: toNumber(payment.serviceOrder.totalAmount),
          employee: payment.serviceOrder.employee
            ? { id: payment.serviceOrder.employee.id, name: payment.serviceOrder.employee.name, email: payment.serviceOrder.employee.email }
            : null,
          hangerCharge: hangerChargeSource
            ? {
                count: Number(hangerChargeSource.count ?? 0),
                pricePerUnit: Number(hangerChargeSource.pricePerUnit ?? 0),
                total: Number(hangerChargeSource.total ?? 0),
              }
            : null,
          creditUsed: payment.serviceOrder.creditUsed ?? 0,
          usageHistory: usageHistory.map((row, index) => ({
            sessionIndex: index + 1,
            orderId: row.id,
            orderNo: row.orderNo,
            receivedAt: row.receivedAt.toISOString(),
            quantity: row.serviceOrderItems.reduce((sum, it) => sum + it.quantity, 0),
            isCurrent: row.id === payment.serviceOrder!.id,
          })),
          memberEntitlement: payment.serviceOrder.memberEntitlement
            ? {
                id: payment.serviceOrder.memberEntitlement.id,
                productName: payment.serviceOrder.memberEntitlement.product.name,
                creditInitial: payment.serviceOrder.memberEntitlement.creditInitial ?? 0,
                creditRemaining: payment.serviceOrder.memberEntitlement.creditRemaining ?? 0,
                endAt: payment.serviceOrder.memberEntitlement.endAt?.toISOString() ?? null,
              }
            : null,
          addonUsages,
          items: serviceItems,
        }
      : null,
  };
};

export type PaymentDocumentPayload = NonNullable<Awaited<ReturnType<typeof buildPaymentDocumentPayload>>>;
