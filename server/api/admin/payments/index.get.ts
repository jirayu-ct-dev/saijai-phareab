import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async () => {
  try {
    const rows = await prisma.paymentRecord.findMany({
      where: { deletedAt: null },
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
        memberEntitlement: {
          select: {
            id: true,
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
        packageSale: {
          select: {
            id: true,
            note: true,
            items: {
              orderBy: [{ createdAt: "asc" }],
              select: {
                id: true,
                itemType: true,
                qty: true,
                totalPrice: true,
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
          },
        },
        slipImage: {
          select: {
            id: true,
            secureUrl: true,
            url: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((row) => {
      const saleMainItem = row.packageSale?.items[0] ?? null;
      const packageProduct = row.memberEntitlement?.product ?? saleMainItem?.product ?? null;
      const packageSaleItems = (row.packageSale?.items ?? []).map((item) => ({
        id: item.id,
        productId: item.product.id,
        productName: item.product.name,
        packageType: item.product.packageType,
        quantity: item.qty,
        totalPrice: Number(item.totalPrice),
      }));

      return {
        id: row.id,
        paymentNo: row.paymentNo,
        amount: Number(row.amount),
        status: row.status,
        paymentMethod: row.paymentMethod,
        note: row.note ?? row.packageSale?.note ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        verifiedAt: row.verifiedAt,
        paidAt: row.paidAt,
        referenceNo: row.referenceNo,
        metadata: row.metadata,
        rejectionReason: row.rejectionReason,
        customer: row.user,
        packageSale: {
          memberEntitlementId: row.memberEntitlement?.id ?? null,
          packageSaleId: row.packageSale?.id ?? null,
          productId: packageProduct?.id ?? null,
          productName: packageProduct?.name ?? null,
          packageType: packageProduct?.packageType ?? null,
          credits: packageProduct?.credits ?? null,
          validityDays: packageProduct?.validityDays ?? null,
          items: packageSaleItems,
        },
        slipImage: row.slipImage
          ? {
              id: row.slipImage.id,
              secureUrl: row.slipImage.secureUrl,
              url: row.slipImage.url,
            }
          : null,
      };
    });
  } catch (error) {
    console.error("[GET /api/admin/payments]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Unable to load payments",
    });
  }
});
