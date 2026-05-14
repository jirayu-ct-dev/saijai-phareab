import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  const addresses = await prisma.userAddress.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
    },
    orderBy: [
      { isDefault: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  return addresses;
});
