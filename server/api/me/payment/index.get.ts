import { requireUser } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { extractPaymentVat } from "~~/server/utils/paymentMeta";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);

  try {
    const rows = await prisma.paymentRecord.findMany({
      where: { userId: user.id, deletedAt: null },
      include: {
        user: {
          select: { id: true, name: true, email: true, phoneNumber: true, image: true },
        },
        memberEntitlement: {
          select: { id: true, product: { select: { id: true, name: true, packageType: true, credits: true, validityDays: true } } },
        },
        packageSale: {
          select: {
            id: true, note: true,
            items: {
              orderBy: [{ createdAt: "asc" }],
              select: {
                id: true, itemType: true, qty: true, totalPrice: true,
                product: { select: { id: true, name: true, packageType: true, credits: true, validityDays: true } },
              },
            },
          },
        },
        serviceOrder: {
          select: {
            id: true, orderNo: true, quotationNo: true, creditUsed: true, memberEntitlementId: true,
            memberEntitlement: { select: { id: true, product: { select: { id: true, name: true } } } },
            serviceOrderItems: { where: { deletedAt: null }, select: { id: true } },
          },
        },
        slipImage: {
          select: { id: true, secureUrl: true, url: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const items = rows.map((row) => {
      const customerName = row.user.name;
      const customerEmail = row.user.email;
      const customerPhoneNumber = row.user.phoneNumber;

      const saleMainItem = row.packageSale?.items[0] ?? null;
      const packageProduct = row.memberEntitlement?.product ?? saleMainItem?.product ?? null;
      const packageSaleItems = (row.packageSale?.items ?? []).map((item) => ({
        id: item.id, productId: item.product.id, productName: item.product.name,
        packageType: item.product.packageType, quantity: item.qty, totalPrice: Number(item.totalPrice),
      }));

      return {
        id: row.id, paymentNo: row.paymentNo, receiptNo: row.receiptNo, amount: Number(row.amount),
        status: row.status, method: row.method, isVerified: row.status === "PAID",
        note: row.note ?? row.packageSale?.note ?? null, createdAt: row.createdAt, updatedAt: row.updatedAt,
        paidAt: row.paidAt, confirmedAt: row.confirmedAt, quotationNo: row.serviceOrder?.quotationNo ?? null,
        vat: extractPaymentVat(row.metadata),
        customer: {
          id: row.user.id, name: customerName, email: customerEmail, phoneNumber: customerPhoneNumber, image: row.user.image,
        },
        packageSale: {
          memberEntitlementId: row.memberEntitlement?.id ?? null, packageSaleId: row.packageSale?.id ?? null,
          productId: packageProduct?.id ?? null, productName: packageProduct?.name ?? null,
          packageType: packageProduct?.packageType ?? null, credits: packageProduct?.credits ?? null,
          validityDays: packageProduct?.validityDays ?? null, items: packageSaleItems,
        },
        serviceOrder: row.serviceOrder ? {
          id: row.serviceOrder.id, orderNo: row.serviceOrder.orderNo,
          itemCount: row.serviceOrder.serviceOrderItems.length, creditUsed: row.serviceOrder.creditUsed ?? 0,
          memberEntitlementId: row.serviceOrder.memberEntitlementId ?? null,
          memberProductName: row.serviceOrder.memberEntitlement?.product.name ?? null,
        } : null,
        slipImage: row.slipImage ? { id: row.slipImage.id, secureUrl: row.slipImage.secureUrl, url: row.slipImage.url } : null,
      };
    });

    return { items, total: items.length };
  } catch (error) {
    console.error("[GET /api/me/payment]", error);
    throw createError({ statusCode: 500, statusMessage: "ไม่สามารถโหลดประวัติการชำระเงินได้" });
  }
});
