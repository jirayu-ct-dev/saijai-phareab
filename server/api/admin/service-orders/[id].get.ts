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
          verifiedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
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
    throw createError({ statusCode: 404, statusMessage: "Service order not found" });
  }

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
    items: serviceOrder.serviceOrderItems.map((item) => ({
      id: item.id,
      storefrontPriceId: item.storefrontPriceId,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      totalPrice: toNumber(item.totalPrice),
      notes: item.notes,
      isPackageIncluded: item.isPackageIncluded,
      service: {
        id: item.storefrontPrice.storefrontService.id,
        name: item.storefrontPrice.storefrontService.name,
      },
      item: {
        id: item.storefrontPrice.storefrontItem.id,
        name: item.storefrontPrice.storefrontItem.name,
      },
      label: `${item.storefrontPrice.storefrontService.name} ${item.storefrontPrice.storefrontItem.name}`.trim(),
    })),
    payments: serviceOrder.payments.map((payment) => ({
      id: payment.id,
      paymentNo: payment.paymentNo,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      amount: toNumber(payment.amount),
      note: payment.note,
      paidAt: payment.paidAt?.toISOString() ?? null,
      verifiedAt: payment.verifiedAt?.toISOString() ?? null,
      verifiedBy: payment.verifiedBy
        ? {
            id: payment.verifiedBy.id,
            name: payment.verifiedBy.name,
            email: payment.verifiedBy.email,
          }
        : null,
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
