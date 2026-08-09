import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

const toNumber = (value: unknown) => Number(value ?? 0);

export default defineEventHandler(async (event) => {
  requireRole(event, ["EMPLOYEE", "ADMIN"]);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Missing service order id" });
  }

  const serviceOrder = await prisma.serviceOrder.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          image: true,
        },
      },
      employee: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      memberEntitlement: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              packageType: true,
              credits: true,
              validityDays: true,
              deductOn: true,
              isDelivery: true,
            },
          },
        },
      },
      payments: {
        where: {
          deletedAt: null,
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          slipImage: {
            select: {
              id: true,
              secureUrl: true,
              url: true,
            },
          },
        },
      },
      addonUsageRecords: {
        where: { refundedAt: null },
        orderBy: { createdAt: "asc" },
      },
      serviceOrderItems: {
        where: {
          deletedAt: null,
        },
        orderBy: {
          createdAt: "asc",
        },
        include: {
          image: {
            select: {
              id: true,
              secureUrl: true,
              url: true,
            },
          },
          photos: {
            where: { deletedAt: null },
            orderBy: { sortOrder: "asc" },
            include: {
              image: {
                select: {
                  id: true,
                  secureUrl: true,
                  url: true,
                },
              },
            },
          },
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
        },
      },
      image: {
        select: {
          id: true,
          secureUrl: true,
          url: true,
        },
      },
      deliveryImage: {
        select: {
          id: true,
          secureUrl: true,
          url: true,
        },
      },
      pickupConfirmation: {
        include: {
          notifications: { orderBy: [{ revision: "desc" }, { kind: "asc" }] },
          responseEvents: { orderBy: [{ createdAt: "desc" }, { id: "desc" }] },
        },
      },
    },
  });

  if (!serviceOrder) {
    throw createError({ statusCode: 404, statusMessage: "Service order not found" });
  }

  const now = new Date();
  const activeEntitlements = serviceOrder.isWalkIn
    ? []
    : await prisma.memberEntitlement.findMany({
        where: {
          customerId: serviceOrder.customerId,
          deletedAt: null,
          status: "ACTIVE",
          startAt: { lte: now },
          endAt: { gte: now },
          creditRemaining: { gt: 0 },
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              packageType: true,
              credits: true,
              validityDays: true,
              deductOn: true,
              isDelivery: true,
            },
          },
        },
        orderBy: [{ product: { packageType: "asc" } }, { activatedAt: "asc" }],
      });

  const hangerCharge = (serviceOrder.hangerCharge ?? null) as
    | { count?: number; pricePerUnit?: number; total?: number }
    | null;

  return {
    id: serviceOrder.id,
    orderNo: serviceOrder.orderNo,
    status: serviceOrder.status,
    isWalkIn: serviceOrder.isWalkIn,
    walkInName: serviceOrder.walkInName,
    walkInPhone: serviceOrder.walkInPhone,
    creditUsed: serviceOrder.creditUsed,
    note: serviceOrder.note,
    receivedAt: serviceOrder.receivedAt.toISOString(),
    dueAt: serviceOrder.dueAt?.toISOString() ?? null,
    createdAt: serviceOrder.createdAt.toISOString(),
    updatedAt: serviceOrder.updatedAt.toISOString(),
    subtotalAmount: toNumber(serviceOrder.subtotalAmount),
    discountAmount: toNumber(serviceOrder.discountAmount),
    totalAmount: toNumber(serviceOrder.totalAmount),
    weightKg: serviceOrder.weightKg != null ? toNumber(serviceOrder.weightKg) : null,
    washFoldPricePerKgSnapshot: serviceOrder.washFoldPricePerKgSnapshot != null ? toNumber(serviceOrder.washFoldPricePerKgSnapshot) : null,
    image: serviceOrder.image
      ? {
          id: serviceOrder.image.id,
          secureUrl: serviceOrder.image.secureUrl,
          url: serviceOrder.image.url,
        }
      : null,
    deliveryImage: serviceOrder.deliveryImage
      ? {
          id: serviceOrder.deliveryImage.id,
          secureUrl: serviceOrder.deliveryImage.secureUrl,
          url: serviceOrder.deliveryImage.url,
        }
      : null,
    hangerCharge: hangerCharge
      ? {
          count: Number(hangerCharge.count ?? 0),
          pricePerUnit: Number(hangerCharge.pricePerUnit ?? 0),
          total: Number(hangerCharge.total ?? 0),
        }
      : null,
    customer: {
      id: serviceOrder.customer.id,
      name: serviceOrder.isWalkIn ? serviceOrder.walkInName || "ลูกค้าหน้าร้าน" : serviceOrder.customer.name,
      email: serviceOrder.isWalkIn ? "ลูกค้าหน้าร้าน" : serviceOrder.customer.email,
      phoneNumber: serviceOrder.isWalkIn ? serviceOrder.walkInPhone : serviceOrder.customer.phoneNumber,
      image: serviceOrder.isWalkIn ? null : serviceOrder.customer.image,
    },
    hasDelivery: serviceOrder.addonUsageRecords.some((usage) => usage.isDelivery),
    pickupConfirmation: serviceOrder.pickupConfirmation
      ? {
          id: serviceOrder.pickupConfirmation.id,
          revision: serviceOrder.pickupConfirmation.revision,
          status: serviceOrder.pickupConfirmation.status,
          response: serviceOrder.pickupConfirmation.response,
          respondedAt: serviceOrder.pickupConfirmation.respondedAt?.toISOString() ?? null,
          responseCount: serviceOrder.pickupConfirmation.responseCount,
          notifications: serviceOrder.pickupConfirmation.notifications.map((job) => ({
            id: job.id,
            revision: job.revision,
            kind: job.kind,
            status: job.status,
            scheduledFor: job.scheduledFor.toISOString(),
            sentAt: job.sentAt?.toISOString() ?? null,
            attempts: job.attempts,
            lastError: job.lastError,
          })),
          responseEvents: serviceOrder.pickupConfirmation.responseEvents.map((responseEvent) => ({
            id: responseEvent.id,
            revision: responseEvent.revision,
            response: responseEvent.response,
            createdAt: responseEvent.createdAt.toISOString(),
            staffNotifiedAt: responseEvent.staffNotifiedAt?.toISOString() ?? null,
            staffNotifyAttempts: responseEvent.staffNotifyAttempts,
            staffNotifyError: responseEvent.staffNotifyError,
          })),
        }
      : null,
    employee: serviceOrder.employee,
    addonUsages: serviceOrder.addonUsageRecords.map((usage) => ({
      id: usage.id,
      entitlementId: usage.memberEntitlementId,
      productId: usage.productId,
      productName: usage.productName,
      credits: usage.credits,
      deductOn: usage.deductOn,
      isDelivery: usage.isDelivery,
      deductedAt: usage.deductedAt?.toISOString() ?? null,
      refundedAt: usage.refundedAt?.toISOString() ?? null,
    })),
    memberEntitlement: serviceOrder.memberEntitlement
      ? {
          id: serviceOrder.memberEntitlement.id,
          status: serviceOrder.memberEntitlement.status,
          creditInitial: serviceOrder.memberEntitlement.creditInitial,
          creditRemaining: serviceOrder.memberEntitlement.creditRemaining,
          activatedAt: serviceOrder.memberEntitlement.activatedAt?.toISOString() ?? null,
          endAt: serviceOrder.memberEntitlement.endAt?.toISOString() ?? null,
          product: serviceOrder.memberEntitlement.product,
        }
      : null,
    activeEntitlements: activeEntitlements.map((ent) => ({
      id: ent.id,
      status: ent.status,
      creditInitial: ent.creditInitial,
      creditRemaining: ent.creditRemaining,
      activatedAt: ent.activatedAt?.toISOString() ?? null,
      endAt: ent.endAt?.toISOString() ?? null,
      product: ent.product,
    })),
    items: serviceOrder.serviceOrderItems.map((item) => ({
      id: item.id,
      storefrontPriceId: item.storefrontPriceId,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      totalPrice: toNumber(item.totalPrice),
      notes: item.notes,
      isPackageIncluded: item.isPackageIncluded,
      image: item.image
        ? {
            id: item.image.id,
            secureUrl: item.image.secureUrl,
            url: item.image.url,
          }
        : null,
      photos: item.photos.map((photo) => ({
        id: photo.id,
        imageId: photo.imageId,
        isDamaged: photo.isDamaged,
        sortOrder: photo.sortOrder,
        secureUrl: photo.image?.secureUrl ?? null,
        url: photo.image?.url ?? null,
      })),
      service: item.storefrontPrice
        ? { id: item.storefrontPrice.storefrontService.id, name: item.storefrontPrice.storefrontService.name }
        : null,
      item: item.storefrontPrice
        ? { id: item.storefrontPrice.storefrontItem.id, name: item.storefrontPrice.storefrontItem.name }
        : null,
      label: item.weightKg != null
        ? (item.weightLabel || "ซัก-พับ ชั่งกิโล")
        : `${item.storefrontPrice?.storefrontService.name ?? ""} ${item.storefrontPrice?.storefrontItem.name ?? ""}`.trim(),
      weightKg: item.weightKg != null ? toNumber(item.weightKg) : null,
      weightLabel: item.weightLabel ?? null,
    })),
    payments: serviceOrder.payments.map((payment) => ({
      id: payment.id,
      paymentNo: payment.paymentNo,
      amount: toNumber(payment.amount),
      status: payment.status,
      method: payment.method,
      note: payment.note,
      paidAt: payment.paidAt?.toISOString() ?? null,
      slipImage: payment.slipImage
        ? {
            id: payment.slipImage.id,
            secureUrl: payment.slipImage.secureUrl,
            url: payment.slipImage.url,
          }
        : null,
    })),
  };
});
