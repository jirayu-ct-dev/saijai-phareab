import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async () => {
  try {
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
        userPackages: {
          where: {
            deletedAt: null,
            parentUserPackageId: null,
            status: "ACTIVE",
          },
          select: {
            id: true,
            creditRemain: true,
            endDate: true,
            package: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: [{ endDate: "asc" }, { createdAt: "desc" }],
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
      const { userPackages, accounts, ...rest } = user;
      return {
        ...rest,
        userPackage: userPackages[0] ?? null,
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
