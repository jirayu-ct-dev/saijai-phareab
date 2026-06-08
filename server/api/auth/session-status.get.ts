import { auth } from "~~/app/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import type { Session, User } from "~~/shared/types/auth";

type SessionWithUser = (Session & { user?: User }) | null;

export default defineEventHandler(async (event) => {
  const context = event.context as typeof event.context & { session?: SessionWithUser };
  if (context.session !== undefined) {
    return context.session;
  }

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(event.node.req.headers)) {
    if (value === undefined) continue;
    headers[key] = Array.isArray(value) ? value.join(",") : value;
  }

  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;

  const freshUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      isActive: true,
      deletedAt: true,
    },
  });

  if (!freshUser) return null;

  return {
    ...session,
    user: {
      ...session.user,
      role: freshUser.role,
      isActive: freshUser.isActive,
      deletedAt: freshUser.deletedAt,
    },
  };
});
