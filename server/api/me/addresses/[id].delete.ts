import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const id = getRouterParam(event, 'id');

  // Check ownership and not already deleted
  const existing = await prisma.userAddress.findFirst({
    where: { 
      id,
      userId: user.id,
      deletedAt: null,
    },
  });

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: "Address not found",
    });
  }

  await prisma.userAddress.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });

  return { success: true };
});
