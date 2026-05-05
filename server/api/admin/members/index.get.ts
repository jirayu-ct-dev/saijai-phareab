import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { getWalkInCustomerEmail } from "~~/server/utils/walkInCustomer";

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const query = getQuery(event);
  const search = String(query.search ?? "").trim();
  const filter = String(query.filter ?? "all"); // all | active | none | expiring

  const now = new Date();
  const expiringCutoff = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      email: { not: getWalkInCustomerEmail() },
      memberEntitlements: { some: { deletedAt: null } },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phoneNumber: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      phoneNumber: true,
      createdAt: true,
      memberEntitlements: {
        where: { deletedAt: null },
        select: {
          id: true,
          status: true,
          creditInitial: true,
          creditRemaining: true,
          startAt: true,
          endAt: true,
          product: { select: { id: true, name: true, packageType: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      paymentRecords: {
        where: { deletedAt: null, paidAt: { not: null } },
        select: { amount: true },
      },
    },
  });

  const enriched = users.map((u) => {
    const active = u.memberEntitlements.filter((e) => e.status === "ACTIVE");
    const activeMain = active.filter((e) => e.product.packageType === "MAIN");
    const activeAddon = active.filter((e) => e.product.packageType === "ADDON");

    const mainCreditRemaining = activeMain.reduce((s, e) => s + (e.creditRemaining ?? 0), 0);
    const mainCreditInitial = activeMain.reduce((s, e) => s + (e.creditInitial ?? 0), 0);
    const addonCreditRemaining = activeAddon.reduce((s, e) => s + (e.creditRemaining ?? 0), 0);
    const addonCreditInitial = activeAddon.reduce((s, e) => s + (e.creditInitial ?? 0), 0);

    const earliestEnd = activeMain
      .map((e) => e.endAt)
      .filter((d): d is Date => Boolean(d))
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
    const totalSpent = u.paymentRecords.reduce((s, p) => s + Number(p.amount), 0);

    return {
      id: u.id,
      email: u.email,
      name: u.name,
      image: u.image,
      phoneNumber: u.phoneNumber,
      createdAt: u.createdAt,
      activeCount: active.length,
      totalEntitlements: u.memberEntitlements.length,
      mainCreditRemaining,
      mainCreditInitial,
      addonCreditRemaining,
      addonCreditInitial,
      earliestEndAt: earliestEnd,
      totalSpent,
      mainPackageName: activeMain[0]?.product.name ?? null,
      addonPackageNames: activeAddon.map((e) => e.product.name),
      entitlements: u.memberEntitlements.map((e) => ({
        id: e.id,
        status: e.status,
        creditInitial: e.creditInitial,
        creditRemaining: e.creditRemaining,
        startAt: e.startAt,
        endAt: e.endAt,
        product: e.product,
      })),
    };
  });

  const filtered = enriched.filter((u) => {
    if (filter === "active") return u.activeCount > 0;
    if (filter === "none") return u.activeCount === 0;
    if (filter === "expiring") return u.earliestEndAt && u.earliestEndAt <= expiringCutoff;
    return true;
  });

  return filtered;
});
