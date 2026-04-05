import { prisma } from "~~/server/utils/prisma";
import { requireUser } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Missing user id" });
  }

  const actor = requireUser(event);
  if (actor.id === id) {
    throw createError({
      statusCode: 400,
      statusMessage: "You cannot delete your own account",
    });
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, email: true },
    });
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: "User not found" });
    }

    if (existing.email === "walkin@saijai.local") {
      throw createError({
        statusCode: 400,
        statusMessage: "Cannot delete system default user",
      });
    }

    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: actor.id,
      },
    });

    return { success: true };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    console.error("[DELETE /api/admin/users/:id]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Unable to delete user",
    });
  }
});
