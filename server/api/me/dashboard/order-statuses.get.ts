import { requireUser } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);

  const query = getQuery(event);
  const { from, to } = parseDateRange(query.from, query.to);

  const BKK_OFFSET = 7 * 60 * 60 * 1000;

  const orders = await prisma.serviceOrder.findMany({
    where: {
      deletedAt: null,
      customerId: user.id,
      createdAt: { gte: from, lte: to },
    },
    select: {
      createdAt: true,
      status: true,
    },
  });

  // Bucket by date (Bangkok)
  const buckets = new Map<string, { received: number; processing: number; completed: number }>();

  for (const o of orders) {
    const localMs = o.createdAt.getTime() + BKK_OFFSET;
    const d = new Date(localMs);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

    if (!buckets.has(key)) buckets.set(key, { received: 0, processing: 0, completed: 0 });
    const b = buckets.get(key)!;

    if (o.status === "RECEIVED") {
      b.received++;
    } else if (o.status === "PROCESSING" || o.status === "DELIVERING") {
      b.processing++;
    } else if (o.status === "COMPLETED") {
      b.completed++;
    }
  }

  // Fill all days in range
  const result: { date: string; received: number; processing: number; completed: number }[] = [];
  const cursor = new Date(from.getTime() + BKK_OFFSET);
  cursor.setUTCHours(0, 0, 0, 0);
  const endLocal = new Date(to.getTime() + BKK_OFFSET);
  endLocal.setUTCHours(0, 0, 0, 0);

  while (cursor <= endLocal) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}-${String(cursor.getUTCDate()).padStart(2, "0")}`;
    const b = buckets.get(key) ?? { received: 0, processing: 0, completed: 0 };
    result.push({ date: key, ...b });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
});
