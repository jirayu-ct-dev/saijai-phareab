import { requireUser } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);

  const query = getQuery(event);
  const { from, to } = parseDateRange(query.from, query.to);

  const rangeMs = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - rangeMs);
  const prevTo = new Date(from.getTime() - 1);

  const baseWhere = { customerId: user.id, deletedAt: null };

  const [
    currentTotal,
    prevTotal,
    currentActive,
    prevActive,
    currentCompleted,
    prevCompleted,
  ] = await Promise.all([
    // ออเดอร์ทั้งหมดในช่วง
    prisma.serviceOrder.count({
      where: { ...baseWhere, createdAt: { gte: from, lte: to } },
    }),
    prisma.serviceOrder.count({
      where: { ...baseWhere, createdAt: { gte: prevFrom, lte: prevTo } },
    }),
    // กำลังดำเนินการ
    prisma.serviceOrder.count({
      where: {
        ...baseWhere,
        status: { in: ["RECEIVED", "PROCESSING", "DELIVERING"] },
        createdAt: { gte: from, lte: to },
      },
    }),
    prisma.serviceOrder.count({
      where: {
        ...baseWhere,
        status: { in: ["RECEIVED", "PROCESSING", "DELIVERING"] },
        createdAt: { gte: prevFrom, lte: prevTo },
      },
    }),
    // เสร็จสิ้น
    prisma.serviceOrder.count({
      where: {
        ...baseWhere,
        status: "COMPLETED",
        createdAt: { gte: from, lte: to },
      },
    }),
    prisma.serviceOrder.count({
      where: {
        ...baseWhere,
        status: "COMPLETED",
        createdAt: { gte: prevFrom, lte: prevTo },
      },
    }),
  ]);

  const calcVariation = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - prev) / prev) * 100);
  };

  return [
    {
      title: "ออเดอร์ทั้งหมด",
      icon: "i-lucide-shopping-basket",
      to: "/me/orders",
      value: currentTotal,
      variation: calcVariation(currentTotal, prevTotal),
      isCurrency: false,
    },
    {
      title: "กำลังดำเนินการ",
      icon: "i-lucide-loader",
      to: "/me/orders",
      value: currentActive,
      variation: calcVariation(currentActive, prevActive),
      isCurrency: false,
    },
    {
      title: "เสร็จสิ้น",
      icon: "i-lucide-check-circle",
      to: "/me/orders",
      value: currentCompleted,
      variation: calcVariation(currentCompleted, prevCompleted),
      isCurrency: false,
    },
  ];
});
