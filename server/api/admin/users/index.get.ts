import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { isInternalCustomerEmail } from "~~/server/utils/customerAccount";

export default defineEventHandler(async (event) => {
  await requireRole(event, ["ADMIN"]);

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
        customerAccountStatus: true,
        emailVerified: true,
        isActive: true,
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
        },
        accounts: {
          where: { providerId: "line" },
          select: { accountId: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    return rows.map((user) => {
      const { memberEntitlements, accounts, ...rest } = user;
      const entitlement = memberEntitlements[0] ?? null;
      return {
        ...rest,
        email: isInternalCustomerEmail(rest.email) ? null : rest.email,
        memberEntitlements: memberEntitlements.map((entitlement) => ({
          id: entitlement.id,
          creditRemaining: entitlement.creditRemaining,
          endAt: entitlement.endAt,
          product: entitlement.product,
        })),
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
