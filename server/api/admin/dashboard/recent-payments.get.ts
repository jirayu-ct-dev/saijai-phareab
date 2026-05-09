import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  await requireRole(event, ["ADMIN", "EMPLOYEE"]);

  const payments = await prisma.paymentRecord.findMany({
    where: { deletedAt: null, status: "PAID" },
    orderBy: { confirmedAt: "desc" },
    take: 8,
    select: {
      id: true,
      paymentNo: true,
      receiptNo: true,
      amount: true,
      method: true,
      packageSaleId: true,
      serviceOrderId: true,
      confirmedAt: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          accounts: {
            where: { providerId: "line" },
            select: { accountId: true },
            take: 1,
          },
        },
      },
    },
  });

  return payments.map((p) => ({
    id: p.id,
    paymentNo: p.paymentNo,
    receiptNo: p.receiptNo,
    amount: Number(p.amount),
    method: p.method,
    paymentType: p.packageSaleId ? "PACKAGE" : "ORDER",
    createdAt: p.createdAt,
    confirmedAt: p.confirmedAt,
    customer: {
      id: p.user.id,
      name: p.user.name ?? "ไม่ระบุชื่อ",
      image: p.user.image,
      lineUserId: p.user.accounts[0]?.accountId ?? null,
    },
  }));
});
