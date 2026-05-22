import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  requireRole(event, ["EMPLOYEE", "ADMIN"]);

  try {
    const sales = await prisma.packageSale.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
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
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            qty: true,
            unitPrice: true,
            totalPrice: true,
            itemType: true,
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
        payments: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            amount: true,
            note: true,
            paidAt: true,
            slipImage: {
              select: {
                id: true,
                secureUrl: true,
                url: true,
              },
            },
          },
        },
      },
    });

    return sales.map((sale) => ({
      id: sale.id,
      status: sale.status,
      subtotalAmount: Number(sale.subtotalAmount),
      discountAmount: Number(sale.discountAmount),
      totalAmount: Number(sale.totalAmount),
      note: sale.note,
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt,
      customer: sale.customer,
      items: sale.items.map((item) => ({
        id: item.id,
        productId: item.product.id,
        productName: item.product.name,
        packageType: item.product.packageType,
        credits: item.product.credits,
        validityDays: item.product.validityDays,
        quantity: item.qty,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      })),
      payment: sale.payments[0]
        ? {
            id: sale.payments[0].id,
            amount: Number(sale.payments[0].amount),
            note: sale.payments[0].note,
            paidAt: sale.payments[0].paidAt,
            slipImage: sale.payments[0].slipImage
              ? {
                  id: sale.payments[0].slipImage.id,
                  secureUrl: sale.payments[0].slipImage.secureUrl,
                  url: sale.payments[0].slipImage.url,
                }
              : null,
          }
        : null,
    }));
  } catch (error) {
    console.error("[GET /api/admin/package-sales]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Unable to load package sales",
    });
  }
});
