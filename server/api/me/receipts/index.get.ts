import { requireUser } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);

  try {
    const receipts = await prisma.paymentRecord.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
      },
      include: {
        serviceOrder: { select: { orderNo: true } },
        packageSale: { select: { id: true, items: { include: { product: { select: { name: true } } } } } }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return receipts.map(receipt => {
      let type = "อื่นๆ";
      let detail = "";
      
      if (receipt.serviceOrderId) {
        type = "บริการซักผ้า";
        detail = receipt.serviceOrder?.orderNo || "";
      } else if (receipt.packageSaleId) {
        type = "ซื้อแพ็กเกจ";
        const products = receipt.packageSale?.items.map(i => i.product.name).join(", ");
        detail = products || "แพ็กเกจ";
      }

      return {
        id: receipt.id,
        paymentNo: receipt.paymentNo,
        type,
        detail,
        amount: Number(receipt.amount),
        paidAt: receipt.paidAt?.toISOString() || receipt.createdAt.toISOString(),
      };
    });
  } catch (error) {
    console.error("[GET /api/me/receipts]", error);
    throw createError({ statusCode: 500, statusMessage: "ไม่สามารถโหลดใบเสร็จได้" });
  }
});
