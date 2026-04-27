import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

const toNumber = (value: unknown) => Number(value ?? 0);

export default defineEventHandler(async (event) => {
  requireRole(event, ["EMPLOYEE", "ADMIN"]);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Missing payment id" });
  }

  const payment = await prisma.paymentRecord.findFirst({
    where: {
      id,
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
      verifiedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      packageSale: {
        include: {
          soldBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  packageType: true,
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
              email: true,
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
            },
            where: {
              deletedAt: null,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!payment) {
    throw createError({ statusCode: 404, statusMessage: "Payment not found" });
  }

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
    quantity: item.qty,
    unitPrice: toNumber(item.unitPrice),
    totalPrice: toNumber(item.totalPrice),
  })) ?? [];

  const serviceItems = payment.serviceOrder?.serviceOrderItems.map((item) => ({
    id: item.id,
    name: `${item.storefrontPrice.storefrontService.name} ${item.storefrontPrice.storefrontItem.name}`.trim(),
    quantity: item.quantity,
    unitPrice: toNumber(item.unitPrice),
    totalPrice: toNumber(item.totalPrice),
    notes: item.notes,
    isPackageIncluded: item.isPackageIncluded,
  })) ?? [];

  const hangerChargeSource = (payment.serviceOrder?.hangerCharge ?? null) as
    | { count?: number; pricePerUnit?: number; total?: number }
    | null;

  return {
    id: payment.id,
    paymentNo: payment.paymentNo,
    receiptType: payment.packageSaleId ? "PACKAGE" : "STOREFRONT",
    createdAt: payment.createdAt.toISOString(),
    paidAt: payment.paidAt?.toISOString() ?? null,
    amount: toNumber(payment.amount),
    paymentMethod: payment.paymentMethod,
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
      ? {
          id: payment.slipImage.id,
          url: payment.slipImage.url,
          secureUrl: payment.slipImage.secureUrl,
        }
      : null,
    customer: {
      id: payment.user.id,
      name: payment.serviceOrder?.isWalkIn ? payment.serviceOrder.walkInName || "ลูกค้าหน้าร้าน" : payment.user.name,
      email: payment.serviceOrder?.isWalkIn ? "ลูกค้าหน้าร้าน" : payment.user.email,
      phoneNumber: payment.serviceOrder?.isWalkIn ? payment.serviceOrder.walkInPhone : payment.user.phoneNumber,
      image: payment.serviceOrder?.isWalkIn ? null : payment.user.image,
    },
    verifiedBy: payment.verifiedBy
      ? {
          id: payment.verifiedBy.id,
          name: payment.verifiedBy.name,
          email: payment.verifiedBy.email,
        }
      : null,
    packageSale: payment.packageSale
      ? {
          id: payment.packageSale.id,
          status: payment.packageSale.status,
          note: payment.packageSale.note,
          subtotalAmount: toNumber(payment.packageSale.subtotalAmount),
          discountAmount: toNumber(payment.packageSale.discountAmount),
          totalAmount: toNumber(payment.packageSale.totalAmount),
          soldBy: payment.packageSale.soldBy
            ? {
                id: payment.packageSale.soldBy.id,
                name: payment.packageSale.soldBy.name,
                email: payment.packageSale.soldBy.email,
              }
            : null,
          items: packageItems,
        }
      : null,
    serviceOrder: payment.serviceOrder
      ? {
          id: payment.serviceOrder.id,
          orderNo: payment.serviceOrder.orderNo,
          isWalkIn: payment.serviceOrder.isWalkIn,
          walkInName: payment.serviceOrder.walkInName,
          walkInPhone: payment.serviceOrder.walkInPhone,
          status: payment.serviceOrder.status,
          note: payment.serviceOrder.note,
          receivedAt: payment.serviceOrder.receivedAt.toISOString(),
          deliveredAt: payment.serviceOrder.status === "COMPLETED"
            ? payment.serviceOrder.updatedAt.toISOString()
            : null,
          dueAt: payment.serviceOrder.dueAt?.toISOString() ?? null,
          subtotalAmount: toNumber(payment.serviceOrder.subtotalAmount),
          discountAmount: toNumber(payment.serviceOrder.discountAmount),
          totalAmount: toNumber(payment.serviceOrder.totalAmount),
          employee: payment.serviceOrder.employee
            ? {
                id: payment.serviceOrder.employee.id,
                name: payment.serviceOrder.employee.name,
                email: payment.serviceOrder.employee.email,
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
          items: serviceItems,
        }
      : null,
  };
});
