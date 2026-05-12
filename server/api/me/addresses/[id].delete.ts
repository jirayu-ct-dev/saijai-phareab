import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  const id = getRouterParam(event, 'id');
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  // Check ownership
  const existing = await prisma.userAddress.findUnique({
    where: { id },
  });

  if (!existing || existing.userId !== user.id) {
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
