import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  await requireRole(event, ["ADMIN", "EMPLOYEE"]);

  const payments = await prisma.paymentRecord.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      paymentNo: true,
      amount: true,
      packageSaleId: true,
      serviceOrderId: true,
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
    amount: Number(p.amount),
    paymentType: p.packageSaleId ? "PACKAGE" : "ORDER",
    createdAt: p.createdAt,
    customer: {
      id: p.user.id,
      name: p.user.name ?? "ไม่ระบุชื่อ",
      image: p.user.image,
      lineUserId: p.user.accounts[0]?.accountId ?? null,
    },
  }));
});
