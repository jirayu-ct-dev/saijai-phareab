import { requireUser } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);

  const query = getQuery(event);
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));
  const skip = (page - 1) * pageSize;

  const where = {
    userId: user.id,
    deletedAt: null,
    status: "PAID" as const,
  };

  try {
    const total = await prisma.paymentRecord.count({ where });
    const receipts = await prisma.paymentRecord.findMany({
      where,
      include: {
        serviceOrder: { select: { orderNo: true } },
        packageSale: { select: { id: true, items: { include: { product: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });


    const items = receipts.map((receipt) => {
      let type = "อื่นๆ";
      let detail = "";

      if (receipt.serviceOrderId) {
        type = "บริการซักผ้า";
        detail = receipt.serviceOrder?.orderNo || "";
      } else if (receipt.packageSaleId) {
        type = "ซื้อแพ็กเกจ";
        const products = receipt.packageSale?.items.map((i) => i.product.name).join(", ");
        detail = products || "แพ็กเกจ";
      }

      return {
        id: receipt.id,
        paymentNo: receipt.paymentNo,
        receiptNo: receipt.receiptNo,
        method: receipt.method,
        type,
        detail,
        amount: Number(receipt.amount),
        paidAt: receipt.paidAt?.toISOString() || receipt.createdAt.toISOString(),
      };
    });

    return { items, total, page, pageSize };
  } catch (error) {
    console.error("[GET /api/me/receipts]", error);
    throw createError({ statusCode: 500, statusMessage: "ไม่สามารถโหลดใบเสร็จได้" });
  }
});

