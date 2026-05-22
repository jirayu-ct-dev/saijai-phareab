import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);

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
