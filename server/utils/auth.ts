import type { H3Event } from "h3";
import type { User } from "~~/shared/types/auth";
import type { Role } from "~~/shared/types/enums";
import { prisma } from "~~/server/utils/prisma";

type EventContextWithUser = H3Event["context"] & { user?: User };

export const getUserFromEvent = (event: H3Event): User | null => {
  const ctx = event.context as EventContextWithUser;
  return ctx.user ?? null;
}

export const requireUser = (event: H3Event): User => {
  const user = getUserFromEvent(event);

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  if (user.deletedAt || user.isActive === false) {
    throw createError({
      statusCode: 403,
      statusMessage: user.deletedAt ? "Account deleted" : "บัญชีนี้ถูกพักการใช้งาน",
    });
  }

  return user;
}

export const requireRole = (event: H3Event, allowedRoles: Role[]): User => {
  const user = requireUser(event);

  if (!allowedRoles.includes(user.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
    });
  }

  return user;
}

export const hasActiveMemberPackage = async (userId: string, now = new Date()): Promise<boolean> => {
  const activePackage = await prisma.memberEntitlement.findFirst({
    where: {
      customerId: userId,
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
    select: { id: true },
  });

  return Boolean(activePackage);
}

export const requireMember = async (event: H3Event): Promise<User> => {
  const user = requireUser(event);
  const isMember = await hasActiveMemberPackage(user.id);

  if (!isMember) {
    throw createError({
      statusCode: 403,
      statusMessage: "Member access required",
    });
  }

  return user;
}
