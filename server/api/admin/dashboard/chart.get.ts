import { prisma } from "~~/server/utils/prisma";


export default defineEventHandler(async (event) => {
  await requireRole(event, ["ADMIN", "EMPLOYEE"]);

  const query = getQuery(event);
  const { from, to } = parseDateRange(query.from, query.to);

  const payments = await prisma.paymentRecord.findMany({
    where: {
      deletedAt: null,
      createdAt: { gte: from, lte: to },
    },
    select: { amount: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Bucket by day (Bangkok UTC+7 = offset 7*3600*1000)
  const BKK_OFFSET = 7 * 60 * 60 * 1000;

  const buckets = new Map<string, number>();

  for (const p of payments) {
    const localMs = p.createdAt.getTime() + BKK_OFFSET;
    const localDate = new Date(localMs);
    const key = `${localDate.getUTCFullYear()}-${String(localDate.getUTCMonth() + 1).padStart(2, "0")}-${String(localDate.getUTCDate()).padStart(2, "0")}`;
    buckets.set(key, (buckets.get(key) ?? 0) + Number(p.amount));
  }

  // Fill all days in range
  const result: { date: string; amount: number }[] = [];
  const cursor = new Date(from.getTime() + BKK_OFFSET);
  cursor.setUTCHours(0, 0, 0, 0);
  const endLocal = new Date(to.getTime() + BKK_OFFSET);
  endLocal.setUTCHours(0, 0, 0, 0);

  while (cursor <= endLocal) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}-${String(cursor.getUTCDate()).padStart(2, "0")}`;
    result.push({ date: key, amount: buckets.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
});
