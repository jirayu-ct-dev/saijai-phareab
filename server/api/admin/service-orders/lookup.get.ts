import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

const toNumber = (value: unknown) => Number(value ?? 0);

export default defineEventHandler(async (event) => {
  requireRole(event, ["EMPLOYEE", "ADMIN"]);

  const q = String(getQuery(event).q ?? "").trim();
  if (!q) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาระบุรหัสที่ต้องการค้นหา" });
  }

  const serviceOrder = await prisma.serviceOrder.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { id: q },
        { orderNo: { equals: q, mode: "insensitive" } },
        { orderNo: { contains: q, mode: "insensitive" } },
        { walkInName: { contains: q, mode: "insensitive" } },
        { walkInPhone: { contains: q, mode: "insensitive" } },
        {
          basket: {
            is: {
              deletedAt: null,
              OR: [
                { qrCode: { equals: q, mode: "insensitive" } },
                { qrCode: { contains: q, mode: "insensitive" } },
                { label: { equals: q, mode: "insensitive" } },
                { label: { contains: q, mode: "insensitive" } },
              ],
            },
          },
        },
        {
          customer: {
            deletedAt: null,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phoneNumber: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      ],
    },
    orderBy: [{ updatedAt: "desc" }],
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
            },
          },
        },
      },
      basket: {
        select: {
          id: true,
          label: true,
          qrCode: true,
          status: true,
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
    },
  });

  if (!serviceOrder) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบรายการรับผ้าที่ค้นหา" });
  }

  const addonEntitlements = serviceOrder.isWalkIn
    ? []
    : await prisma.memberEntitlement.findMany({
        where: {
          customerId: serviceOrder.customerId,
          status: "ACTIVE",
          deletedAt: null,
          product: { packageType: "ADDON" },
        },
        include: {
          product: { select: { id: true, name: true, packageType: true, credits: true } },
        },
        orderBy: { createdAt: "asc" },
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
    employee: serviceOrder.employee,
    basket: serviceOrder.basket,
    addonEntitlements: addonEntitlements.map((e) => ({
      id: e.id,
      status: e.status,
      creditInitial: e.creditInitial,
      creditRemaining: e.creditRemaining,
      endAt: e.endAt?.toISOString() ?? null,
      product: e.product,
    })),
    addonUsages: Array.isArray(serviceOrder.addonUsages) ? serviceOrder.addonUsages : [],
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
      label: `${item.storefrontPrice?.storefrontService.name ?? ""} ${item.storefrontPrice?.storefrontItem.name ?? ""}`.trim(),
    })),
    payments: serviceOrder.payments.map((payment) => ({
      id: payment.id,
      paymentNo: payment.paymentNo,
      amount: toNumber(payment.amount),
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
