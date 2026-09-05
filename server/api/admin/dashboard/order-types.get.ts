import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  await requireRole(event, ["ADMIN", "EMPLOYEE"]);

  const query = getQuery(event);
  const { from, to } = parseDateRange(query.from, query.to);

  const BKK_OFFSET = 7 * 60 * 60 * 1000;

  const orders = await prisma.serviceOrder.findMany({
    where: { deletedAt: null, receivedAt: { gte: from, lte: to } },
    select: {
      receivedAt: true,
      memberEntitlementId: true,
      weightKg: true,
    },
  });

  // Bucket by date (Bangkok)
  const buckets = new Map<string, { storefront: number; washfold: number; package: number }>()

  for (const o of orders) {
    const localMs = o.receivedAt.getTime() + BKK_OFFSET;
    const d = new Date(localMs);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

    if (!buckets.has(key)) buckets.set(key, { storefront: 0, washfold: 0, package: 0 });
    const b = buckets.get(key)!;

    if (o.memberEntitlementId) {
      b.package++;
    } else if (o.weightKg !== null) {
      b.washfold++;
    } else {
      b.storefront++;
    }
  }

  // Fill all days in range
  const result: { date: string; storefront: number; washfold: number; package: number }[] = [];
  const cursor = new Date(from.getTime() + BKK_OFFSET);
  cursor.setUTCHours(0, 0, 0, 0);
  const endLocal = new Date(to.getTime() + BKK_OFFSET);
  endLocal.setUTCHours(0, 0, 0, 0);

  while (cursor <= endLocal) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}-${String(cursor.getUTCDate()).padStart(2, "0")}`;
    const b = buckets.get(key) ?? { storefront: 0, washfold: 0, package: 0 };
    result.push({ date: key, ...b });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
});
