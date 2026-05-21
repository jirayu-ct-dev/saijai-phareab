import { Prisma } from "~~/app/generated/prisma/client";
import { prisma } from "~~/server/utils/prisma";
import type { Role } from "~~/shared/types/enums";
import { syncUserRichMenu } from "~~/server/utils/line-messaging";

type UpdateUserBody = {
  email?: string;
  name?: string | null;
  phoneNumber?: string | null;
  role?: Role;
  emailVerified?: boolean;
  isActive?: boolean;
};

const ALLOWED_ROLES: Role[] = ["USER", "EMPLOYEE", "ADMIN"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Missing user id" });
  }

  const body = await readBody<UpdateUserBody>(event);
  const payload: {
    email?: string;
    name?: string | null;
    phoneNumber?: string | null;
    role?: Role;
    emailVerified?: boolean;
    isActive?: boolean;
  } = {};

  if (body.email !== undefined) {
    const email = body.email.trim().toLowerCase();
    if (!email || !EMAIL_REGEX.test(email)) {
      throw createError({ statusCode: 400, statusMessage: "Invalid email" });
    }
    payload.email = email;
  }

  if (body.role !== undefined) {
    if (!ALLOWED_ROLES.includes(body.role)) {
      throw createError({ statusCode: 400, statusMessage: "Invalid role" });
    }
    payload.role = body.role;
  }

  if (body.name !== undefined) {
    payload.name = body.name?.trim() || null;
  }

  if (body.phoneNumber !== undefined) {
    payload.phoneNumber = body.phoneNumber?.trim() || null;
  }

  if (body.emailVerified !== undefined) {
    payload.emailVerified = body.emailVerified;
  }

  if (body.isActive !== undefined) {
    payload.isActive = body.isActive;
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, role: true },
    });
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: "User not found" });
    }

    const isRoleChanged = payload.role !== undefined && payload.role !== existing.role;
    const isDeactivated = body.isActive === false;

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: payload,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phoneNumber: true,
          emailVerified: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      let sessionsRevoked = 0;
      if (isRoleChanged || isDeactivated) {
        const revokeResult = await tx.session.deleteMany({
          where: { userId: id },
        });
        sessionsRevoked = revokeResult.count;
      }

      return {
        ...user,
        sessionsRevoked,
      };
    });

    if (isRoleChanged || isDeactivated) {
      void syncUserRichMenu(id).catch((err) =>
        console.error(`[PUT /api/admin/users/:id] Failed to sync rich menu:`, err),
      );
    }

    return result;
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    console.error("[PUT /api/admin/users/:id]", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw createError({
        statusCode: 409,
        statusMessage: "Email already exists",
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Unable to update user",
    });
  }
});
