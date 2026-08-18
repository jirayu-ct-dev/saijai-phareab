import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  await requireRole(event, ["ADMIN", "EMPLOYEE"]);

  const orders = await prisma.serviceOrder.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      orderNo: true,
      status: true,
      memberEntitlementId: true,
      creditUsed: true,
      hangerCharge: true,
      totalAmount: true,
      createdAt: true,
      customer: {
        select: {
          id: true,
          name: true,
          image: true,
          phoneNumber: true,
          accounts: {
            where: { providerId: "line" },
            select: { accountId: true },
            take: 1,
          },
        },
      },
    },
  });

  return orders.map((o) => ({
    id: o.id,
    orderNo: o.orderNo,
    status: o.status,
    orderType: o.memberEntitlementId ? "PACKAGE" : "STOREFRONT",
    creditUsed: o.creditUsed,
    hangerCharge: o.hangerCharge as { count: number; pricePerUnit: number; total: number } | null,
    totalAmount: Number(o.totalAmount ?? 0),
    createdAt: o.createdAt,
    customer: {
      id: o.customer.id,
      name: o.customer.name ?? "ไม่ระบุชื่อ",
      image: o.customer.image,
      phoneNumber: o.customer.phoneNumber,
      lineUserId: o.customer.accounts[0]?.accountId ?? null,
    },
  }));
});
