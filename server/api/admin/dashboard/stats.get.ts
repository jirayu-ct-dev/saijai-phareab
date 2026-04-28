import { prisma } from "~~/server/utils/prisma";
import { getWalkInCustomerEmail } from "~~/server/utils/walkInCustomer";

export default defineEventHandler(async (event) => {
  await requireRole(event, ["ADMIN", "EMPLOYEE"]);

  const query = getQuery(event);
  const { from, to } = parseDateRange(query.from, query.to);

  const rangeMs = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - rangeMs);
  const prevTo = new Date(from.getTime() - 1);

  const [
    currentOrderRevenue,
    prevOrderRevenue,
    currentPackageRevenue,
    prevPackageRevenue,
    currentNewUsers,
    prevNewUsers,
  ] = await Promise.all([
    // ยอดออเดอร์ผ้า = PaymentRecord ที่มี serviceOrderId
    prisma.paymentRecord.aggregate({
      _sum: { amount: true },
      where: { deletedAt: null, serviceOrderId: { not: null }, createdAt: { gte: from, lte: to } },
    }),
    prisma.paymentRecord.aggregate({
      _sum: { amount: true },
      where: { deletedAt: null, serviceOrderId: { not: null }, createdAt: { gte: prevFrom, lte: prevTo } },
    }),
    // ยอดซื้อแพ็กเกจ = PaymentRecord ที่มี packageSaleId
    prisma.paymentRecord.aggregate({
      _sum: { amount: true },
      where: { deletedAt: null, packageSaleId: { not: null }, createdAt: { gte: from, lte: to } },
    }),
    prisma.paymentRecord.aggregate({
      _sum: { amount: true },
      where: { deletedAt: null, packageSaleId: { not: null }, createdAt: { gte: prevFrom, lte: prevTo } },
    }),
    prisma.user.count({
      where: {
        deletedAt: null,
        role: "USER",
        email: { not: getWalkInCustomerEmail() },
        createdAt: { gte: from, lte: to },
      },
    }),
    prisma.user.count({
      where: {
        deletedAt: null,
        role: "USER",
        email: { not: getWalkInCustomerEmail() },
        createdAt: { gte: prevFrom, lte: prevTo },
      },
    }),
  ]);

  const calcVariation = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - prev) / prev) * 100);
  };

  const orderAmt = Number(currentOrderRevenue._sum.amount ?? 0);
  const prevOrderAmt = Number(prevOrderRevenue._sum.amount ?? 0);
  const packageAmt = Number(currentPackageRevenue._sum.amount ?? 0);
  const prevPackageAmt = Number(prevPackageRevenue._sum.amount ?? 0);

  return [
    {
      title: "ลูกค้าใหม่",
      icon: "i-lucide-user-plus",
      to: "/admin/users",
      value: currentNewUsers,
      variation: calcVariation(currentNewUsers, prevNewUsers),
      isCurrency: false,
    },
    {
      title: "ยอดซื้อแพ็กเกจ",
      icon: "i-lucide-package",
      to: "/admin/payment",
      value: packageAmt,
      variation: calcVariation(packageAmt, prevPackageAmt),
      isCurrency: true,
    },
    {
      title: "ยอดออเดอร์ผ้า",
      icon: "i-lucide-shirt",
      to: "/admin/service-orders",
      value: orderAmt,
      variation: calcVariation(orderAmt, prevOrderAmt),
      isCurrency: true,
    },
  ];
});
