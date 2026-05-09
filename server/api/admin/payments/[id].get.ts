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
      memberEntitlement: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              packageType: true,
              price: true,
              credits: true,
              validityDays: true,
            },
          },
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
                  price: true,
                  credits: true,
                  validityDays: true,
                },
              },
              memberEntitlements: {
                where: {
                  deletedAt: null,
                },
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      packageType: true,
                      price: true,
                      credits: true,
                      validityDays: true,
                    },
                  },
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
              image: {
                select: { id: true, url: true, secureUrl: true },
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
        },
      },
    },
  });

  if (!payment) {
    throw createError({ statusCode: 404, statusMessage: "Payment not found" });
  }

  const packageItems = payment.packageSale?.items.map((item) => ({
    id: item.id,
    itemType: item.itemType,
    quantity: item.qty,
    unitPrice: toNumber(item.unitPrice),
    totalPrice: toNumber(item.totalPrice),
    product: {
      id: item.product.id,
      name: item.product.name,
      packageType: item.product.packageType,
      price: toNumber(item.product.price),
      credits: item.product.credits,
      validityDays: item.product.validityDays,
    },
  })) ?? [];

  const packageEntitlements = payment.packageSale?.items.flatMap((item) =>
    item.memberEntitlements.map((entitlement) => ({
      id: entitlement.id,
      status: entitlement.status,
      creditInitial: entitlement.creditInitial,
      creditRemaining: entitlement.creditRemaining,
      startAt: entitlement.startAt?.toISOString() ?? null,
      endAt: entitlement.endAt?.toISOString() ?? null,
      activatedAt: entitlement.activatedAt?.toISOString() ?? null,
      product: {
        id: entitlement.product.id,
        name: entitlement.product.name,
        packageType: entitlement.product.packageType,
        price: toNumber(entitlement.product.price),
        credits: entitlement.product.credits,
        validityDays: entitlement.product.validityDays,
      },
    })),
  ) ?? [];

  const primaryEntitlement = payment.memberEntitlement
    ? {
        id: payment.memberEntitlement.id,
        status: payment.memberEntitlement.status,
        creditInitial: payment.memberEntitlement.creditInitial,
        creditRemaining: payment.memberEntitlement.creditRemaining,
        startAt: payment.memberEntitlement.startAt?.toISOString() ?? null,
        endAt: payment.memberEntitlement.endAt?.toISOString() ?? null,
        activatedAt: payment.memberEntitlement.activatedAt?.toISOString() ?? null,
        product: {
          id: payment.memberEntitlement.product.id,
          name: payment.memberEntitlement.product.name,
          packageType: payment.memberEntitlement.product.packageType,
          price: toNumber(payment.memberEntitlement.product.price),
          credits: payment.memberEntitlement.product.credits,
          validityDays: payment.memberEntitlement.product.validityDays,
        },
      }
    : packageEntitlements[0] ?? null;

  const serviceItems = payment.serviceOrder?.serviceOrderItems.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    unitPrice: toNumber(item.unitPrice),
    totalPrice: toNumber(item.totalPrice),
    isPackageIncluded: item.isPackageIncluded,
    notes: item.notes,
    storefrontPriceId: item.storefrontPriceId,
    service: {
      id: item.storefrontPrice.storefrontService.id,
      name: item.storefrontPrice.storefrontService.name,
    },
    item: {
      id: item.storefrontPrice.storefrontItem.id,
      name: item.storefrontPrice.storefrontItem.name,
    },
    label: `${item.storefrontPrice.storefrontService.name} ${item.storefrontPrice.storefrontItem.name}`.trim(),
    image: item.image ? { id: item.image.id, url: item.image.url, secureUrl: item.image.secureUrl } : null,
    photos: item.photos.map((photo) => ({
      id: photo.id,
      imageId: photo.imageId,
      isDamaged: photo.isDamaged,
      sortOrder: photo.sortOrder,
      url: photo.image.url,
      secureUrl: photo.image.secureUrl,
    })),
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
    amount: toNumber(payment.amount),
    note: payment.note,
    paidAt: payment.paidAt?.toISOString() ?? null,
    confirmedAt: payment.confirmedAt?.toISOString() ?? null,
    confirmedById: payment.confirmedById ?? null,
    metadata: payment.metadata,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
    customer: {
      id: payment.user.id,
      name: payment.serviceOrder?.isWalkIn ? payment.serviceOrder.walkInName || "ลูกค้าหน้าร้าน" : payment.user.name,
      email: payment.serviceOrder?.isWalkIn ? "ลูกค้าหน้าร้าน" : payment.user.email,
      phoneNumber: payment.serviceOrder?.isWalkIn ? payment.serviceOrder.walkInPhone : payment.user.phoneNumber,
      image: payment.serviceOrder?.isWalkIn ? null : payment.user.image,
    },
    slipImage: payment.slipImage
      ? {
          id: payment.slipImage.id,
          url: payment.slipImage.url,
          secureUrl: payment.slipImage.secureUrl,
        }
      : null,
    memberEntitlement: primaryEntitlement,
    memberEntitlements: packageEntitlements,
    packageSale: payment.packageSale
      ? {
          id: payment.packageSale.id,
          status: payment.packageSale.status,
          subtotalAmount: toNumber(payment.packageSale.subtotalAmount),
          discountAmount: toNumber(payment.packageSale.discountAmount),
          totalAmount: toNumber(payment.packageSale.totalAmount),
          note: payment.packageSale.note,
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
          quotationNo: payment.serviceOrder.quotationNo,
          status: payment.serviceOrder.status,
          isWalkIn: payment.serviceOrder.isWalkIn,
          walkInName: payment.serviceOrder.walkInName,
          walkInPhone: payment.serviceOrder.walkInPhone,
          creditUsed: payment.serviceOrder.creditUsed,
          receivedAt: payment.serviceOrder.receivedAt?.toISOString() ?? null,
          dueAt: payment.serviceOrder.dueAt?.toISOString() ?? null,
          subtotalAmount: toNumber(payment.serviceOrder.subtotalAmount),
          discountAmount: toNumber(payment.serviceOrder.discountAmount),
          totalAmount: toNumber(payment.serviceOrder.totalAmount),
          note: payment.serviceOrder.note,
          employee: payment.serviceOrder.employee
            ? {
                id: payment.serviceOrder.employee.id,
                name: payment.serviceOrder.employee.name,
                email: payment.serviceOrder.employee.email,
              }
            : null,
          memberEntitlement: payment.serviceOrder.memberEntitlement
            ? {
                id: payment.serviceOrder.memberEntitlement.id,
                status: payment.serviceOrder.memberEntitlement.status,
                product: {
                  id: payment.serviceOrder.memberEntitlement.product.id,
                  name: payment.serviceOrder.memberEntitlement.product.name,
                  packageType: payment.serviceOrder.memberEntitlement.product.packageType,
                  credits: payment.serviceOrder.memberEntitlement.product.credits,
                  validityDays: payment.serviceOrder.memberEntitlement.product.validityDays,
                },
              }
            : null,
          basket: payment.serviceOrder.basket
            ? {
                id: payment.serviceOrder.basket.id,
                label: payment.serviceOrder.basket.label,
                qrCode: payment.serviceOrder.basket.qrCode,
              }
            : null,
          hangerCharge: hangerChargeSource
            ? {
                count: Number(hangerChargeSource.count ?? 0),
                pricePerUnit: Number(hangerChargeSource.pricePerUnit ?? 0),
                total: Number(hangerChargeSource.total ?? 0),
              }
            : null,
          items: serviceItems,
        }
      : null,
  };
});
