import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  await requireRole(event, ["EMPLOYEE", "ADMIN"]);

  const orders = await prisma.serviceOrder.findMany({
    where: {
      deletedAt: null,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
    take: 50,
    select: {
      id: true,
      orderNo: true,
      status: true,
      createdAt: true,
      dueAt: true,
      customer: {
        select: {
          id: true,
          name: true,
          phoneNumber: true,
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

  return orders.map((order) => {
    const customer = {
      id: order.customer.id,
      name: order.customer.name ?? "-",
      phoneNumber: order.customer.phoneNumber,
      image: order.customer.image,
      lineUserId: order.customer.accounts[0]?.accountId ?? null,
    };

    return {
      id: order.id,
      orderNo: order.orderNo,
      status: order.status,
      createdAt: order.createdAt,
      dueAt: order.dueAt,
      customer,
    };
  });
});
