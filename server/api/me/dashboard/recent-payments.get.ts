import { requireUser } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);

  const payments = await prisma.paymentRecord.findMany({
    where: { deletedAt: null, userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      paymentNo: true,
      amount: true,
      packageSaleId: true,
      serviceOrderId: true,
      createdAt: true,
    },
  });

  return payments.map((p) => ({
    id: p.id,
    paymentNo: p.paymentNo,
    amount: Number(p.amount),
    paymentType: p.packageSaleId ? "PACKAGE" : "ORDER",
    createdAt: p.createdAt,
  }));
});
