import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { isInternalCustomerEmail } from "~~/server/utils/customerAccount";
import { packageSaleStatusByPaymentStatus } from "~~/server/utils/paymentStateTransition";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Missing user id" });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        phoneNumber: true,
        customerAccountStatus: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        accounts: {
          where: { providerId: "line" },
          select: { accountId: true },
          take: 1,
        },
        memberEntitlements: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            status: true,
            creditInitial: true,
            creditRemaining: true,
            startAt: true,
            endAt: true,
            activatedAt: true,
            suspendedAt: true,
            createdAt: true,
            product: {
              select: {
                id: true,
                name: true,
                packageType: true,
                credits: true,
                validityDays: true,
                price: true,
              },
            },
            sourceSaleItem: {
              select: {
                id: true,
                packageSale: {
                  select: {
                    id: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
        },
        paymentRecords: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            amount: true,
            note: true,
            createdAt: true,
            paidAt: true,
            packageSale: {
              select: {
                id: true,
                items: {
                  orderBy: { createdAt: "asc" },
                  select: {
                    id: true,
                    qty: true,
                    totalPrice: true,
                    product: {
                      select: {
                        id: true,
                        name: true,
                        packageType: true,
                      },
                    },
                  },
                },
              },
            },
            serviceOrder: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        },
        packageSales: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            totalAmount: true,
            note: true,
            createdAt: true,
            items: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                qty: true,
                totalPrice: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                    packageType: true,
                  },
                },
              },
            },
            payments: {
              where: { deletedAt: null },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                amount: true,
                status: true,
                paidAt: true,
                createdAt: true,
              },
            },
          },
        },
        serviceOrders: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            status: true,
            creditUsed: true,
            totalAmount: true,
            note: true,
            createdAt: true,
            memberEntitlement: {
              select: {
                id: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            serviceOrderItems: {
              where: { deletedAt: null },
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                quantity: true,
                totalPrice: true,
                isPackageIncluded: true,
                storefrontPrice: {
                  select: {
                    storefrontItem: {
                      select: { name: true },
                    },
                    storefrontService: {
                      select: { name: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw createError({ statusCode: 404, statusMessage: "User not found" });
    }

    const activeEntitlements = user.memberEntitlements.filter((entitlement) => entitlement.status === "ACTIVE");
    const activeMain = activeEntitlements.filter((e) => e.product.packageType === "MAIN");
    const activeAddon = activeEntitlements.filter((e) => e.product.packageType === "ADDON");

    const mainCreditsRemaining = activeMain.reduce((sum, e) => sum + (e.creditRemaining ?? 0), 0);
    const mainCreditsInitial = activeMain.reduce((sum, e) => sum + (e.creditInitial ?? 0), 0);
    const addonCreditsRemaining = activeAddon.reduce((sum, e) => sum + (e.creditRemaining ?? 0), 0);
    const addonCreditsInitial = activeAddon.reduce((sum, e) => sum + (e.creditInitial ?? 0), 0);

    const totalCreditsRemaining = mainCreditsRemaining + addonCreditsRemaining;
    const totalCreditsUsed = user.memberEntitlements.reduce((sum, entitlement) => {
      const creditInitial = entitlement.creditInitial ?? 0;
      const creditRemaining = entitlement.creditRemaining ?? 0;
      return sum + Math.max(creditInitial - creditRemaining, 0);
    }, 0);
    const totalSpent = user.paymentRecords
      .filter((payment) => payment.paidAt !== null)
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    return {
      user: {
        id: user.id,
        email: isInternalCustomerEmail(user.email) ? null : user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        phoneNumber: user.phoneNumber,
        customerAccountStatus: user.customerAccountStatus,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lineUserId: user.accounts[0]?.accountId ?? null,
      },
      stats: {
        activeEntitlementCount: activeEntitlements.length,
        totalEntitlementCount: user.memberEntitlements.length,
        totalCreditsRemaining,
        totalCreditsUsed,
        mainCreditsRemaining,
        mainCreditsInitial,
        addonCreditsRemaining,
        addonCreditsInitial,
        totalPackageSales: user.packageSales.length,
        totalPayments: user.paymentRecords.length,
        totalServiceOrders: user.serviceOrders.length,
        totalSpent,
      },
      memberEntitlements: user.memberEntitlements.map((entitlement) => ({
        id: entitlement.id,
        status: entitlement.status,
        creditInitial: entitlement.creditInitial,
        creditRemaining: entitlement.creditRemaining,
        creditUsed: Math.max((entitlement.creditInitial ?? 0) - (entitlement.creditRemaining ?? 0), 0),
        startAt: entitlement.startAt,
        endAt: entitlement.endAt,
        activatedAt: entitlement.activatedAt,
        suspendedAt: entitlement.suspendedAt,
        createdAt: entitlement.createdAt,
        product: {
          id: entitlement.product.id,
          name: entitlement.product.name,
          packageType: entitlement.product.packageType,
          credits: entitlement.product.credits,
          validityDays: entitlement.product.validityDays,
          price: Number(entitlement.product.price),
        },
        sourceSale: entitlement.sourceSaleItem?.packageSale
          ? {
              id: entitlement.sourceSaleItem.packageSale.id,
              createdAt: entitlement.sourceSaleItem.packageSale.createdAt,
            }
          : null,
      })),
      recentPayments: user.paymentRecords.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
        note: payment.note,
        createdAt: payment.createdAt,
        paidAt: payment.paidAt,
        packageSale: payment.packageSale
          ? {
              id: payment.packageSale.id,
              items: payment.packageSale.items.map((item) => ({
                id: item.id,
                quantity: item.qty,
                totalPrice: Number(item.totalPrice),
                product: {
                  id: item.product.id,
                  name: item.product.name,
                  packageType: item.product.packageType,
                },
              })),
            }
          : null,
        serviceOrder: payment.serviceOrder,
      })),
      recentSales: user.packageSales.map((sale) => ({
        id: sale.id,
        status: sale.payments[0]
          ? packageSaleStatusByPaymentStatus[sale.payments[0].status]
          : "PENDING",
        totalAmount: Number(sale.totalAmount),
        note: sale.note,
        createdAt: sale.createdAt,
        items: sale.items.map((item) => ({
          id: item.id,
          quantity: item.qty,
          totalPrice: Number(item.totalPrice),
          product: {
            id: item.product.id,
            name: item.product.name,
            packageType: item.product.packageType,
          },
        })),
        payment: sale.payments[0]
          ? {
              id: sale.payments[0].id,
              amount: Number(sale.payments[0].amount),
              createdAt: sale.payments[0].createdAt,
            }
          : null,
      })),
      recentServiceOrders: user.serviceOrders.map((order) => ({
        id: order.id,
        status: order.status,
        creditUsed: order.creditUsed,
        totalAmount: order.totalAmount != null ? Number(order.totalAmount) : null,
        note: order.note,
        createdAt: order.createdAt,
        memberEntitlement: order.memberEntitlement
          ? {
              id: order.memberEntitlement.id,
              product: order.memberEntitlement.product,
            }
          : null,
        items: order.serviceOrderItems.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          totalPrice: Number(item.totalPrice),
          isPackageIncluded: item.isPackageIncluded,
          label: item.storefrontPrice
            ? `${item.storefrontPrice.storefrontItem.name} / ${item.storefrontPrice.storefrontService.name}`
            : "",
        })),
      })),
    };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    console.error("[GET /api/admin/users/:id]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Unable to load user details",
    });
  }
});
