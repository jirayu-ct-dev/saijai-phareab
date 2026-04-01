import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async () => {
  try {
    const now = new Date();
    const rows = await prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        phoneNumber: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        memberEntitlements: {
          where: {
            deletedAt: null,
            status: "ACTIVE",
            AND: [
              {
                OR: [{ startAt: null }, { startAt: { lte: now } }],
              },
              {
                OR: [{ endAt: null }, { endAt: { gte: now } }],
              },
            ],
          },
          select: {
            id: true,
            creditRemaining: true,
            endAt: true,
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: [{ endAt: "asc" }, { createdAt: "desc" }],
          take: 1,
        },
        accounts: {
          where: { providerId: "line" },
          select: { accountId: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((user) => {
      const { memberEntitlements, accounts, ...rest } = user;
      const entitlement = memberEntitlements[0] ?? null;
      return {
        ...rest,
        memberEntitlement: entitlement
          ? {
              id: entitlement.id,
              creditRemaining: entitlement.creditRemaining,
              endAt: entitlement.endAt,
              product: entitlement.product,
            }
          : null,
        lineUserId: accounts[0]?.accountId ?? null,
      };
    });
  } catch (error) {
    console.error("[GET /api/admin/users]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Unable to load users",
    });
  }
});
