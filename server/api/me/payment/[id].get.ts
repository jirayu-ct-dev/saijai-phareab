import { requireUser } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { extractPaymentVat } from "~~/server/utils/paymentMeta";
import { loadPaymentQrPresentation } from "~~/server/utils/paymentQrPresentation";
import { packageSaleStatusByPaymentStatus } from "~~/server/utils/paymentStateTransition";

const toNumber = (value: unknown) => Number(value ?? 0);

export default defineEventHandler(async (event) => {
  const user = requireUser(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Missing payment id" });
  }

  const payment = await prisma.paymentRecord.findFirst({
    where: {
      id,
      userId: user.id,
      deletedAt: null,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          image: true,
        },
      },
      slipImage: {
        select: {
          id: true,
          url: true,
          secureUrl: true,
        },
      },
      packageSale: {
        include: {
          soldBy: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  packageType: true,
                  credits: true,
                  validityDays: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      serviceOrder: {
        include: {
          employee: {
            select: {
              id: true,
              name: true,
            },
          },
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
                  storefrontService: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                  storefrontItem: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
              photos: {
                where: { deletedAt: null },
                include: { image: { select: { id: true, url: true, secureUrl: true } } },
                orderBy: { sortOrder: "asc" },
              },
            },
            where: {
              deletedAt: null,
            },
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

  if (!payment) {
    throw createError({ statusCode: 404, statusMessage: "Payment not found" });
  }

  const paymentQr = payment.serviceOrder
    ? await loadPaymentQrPresentation({ paymentId: payment.id, userId: user.id })
    : null;

  const usageHistory = payment.serviceOrder?.memberEntitlementId
    ? await prisma.serviceOrder.findMany({
        where: {
          memberEntitlementId: payment.serviceOrder.memberEntitlementId,
          deletedAt: null,
        },
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
    credits: item.product.credits,
    validityDays: item.product.validityDays,
    quantity: item.qty,
    unitPrice: toNumber(item.unitPrice),
    totalPrice: toNumber(item.totalPrice),
  })) ?? [];

  const isWashFoldOrder = payment.serviceOrder?.weightKg != null;
  const serviceItems = payment.serviceOrder?.serviceOrderItems.map((item) => ({
    id: item.id,
    name: `${item.storefrontPrice?.storefrontService.name ?? ""} ${item.storefrontPrice?.storefrontItem.name ?? ""}`.trim(),
    serviceName: item.storefrontPrice?.storefrontService.name ?? null,
    quantity: item.quantity,
    unitPrice: toNumber(item.unitPrice),
    totalPrice: toNumber(item.totalPrice),
    notes: item.notes,
    isPackageIncluded: item.isPackageIncluded,
    isWashFold: isWashFoldOrder,
    weightKg: null as number | null,
    image: item.photos[0]?.image
      ? { id: item.photos[0].image.id, url: item.photos[0].image.url, secureUrl: item.photos[0].image.secureUrl }
      : null,
    photos: item.photos.map((photo) => ({
      id: photo.id,
      imageId: photo.imageId,
      isDamaged: photo.isDamaged,
      sortOrder: photo.sortOrder,
      url: photo.image.url,
      secureUrl: photo.image.secureUrl,
    })),
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
    status: payment.status,
    method: payment.method,
    receiptType: payment.packageSaleId ? "PACKAGE" : "STOREFRONT",
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
    paidAt: payment.paidAt?.toISOString() ?? null,
    confirmedAt: payment.confirmedAt?.toISOString() ?? null,
    amount: toNumber(payment.amount),
    note: payment.note,
    paymentQr,
    vat: extractPaymentVat(payment.metadata),
    slipImage: payment.slipImage
      ? {
          id: payment.slipImage.id,
          url: payment.slipImage.url,
          secureUrl: payment.slipImage.secureUrl,
        }
      : null,
    customer: {
      id: payment.user.id,
      name: payment.user.name,
      email: payment.user.email,
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
            ? {
                id: payment.packageSale.soldBy.id,
                name: payment.packageSale.soldBy.name,
              }
            : null,
          items: packageItems,
        }
      : null,
    serviceOrder: payment.serviceOrder
      ? {
          id: payment.serviceOrder.id,
          orderNo: payment.serviceOrder.orderNo,
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
            ? {
                id: payment.serviceOrder.employee.id,
                name: payment.serviceOrder.employee.name,
              }
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
});
