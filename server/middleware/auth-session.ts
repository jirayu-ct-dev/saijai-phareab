import { auth } from "~~/app/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { requireMember, requireRole } from "~~/server/utils/auth";
import type { Session, User } from "~~/shared/types/auth";
import type { Role } from "~~/shared/types/enums";

type SessionWithUser = (Session & { user?: User }) | null;

type AccessPolicy = {
  prefix: string;
  roles?: Role[];
  requireMember?: boolean;
};

const ACCESS_POLICIES: AccessPolicy[] = [
  { prefix: "/api/admin/users", roles: ["ADMIN"] },
  { prefix: "/api/admin/deleted", roles: ["ADMIN"] },
  { prefix: "/api/admin/packages", roles: ["ADMIN"] },
  { prefix: "/api/admin/employees", roles: ["ADMIN"] },
  { prefix: "/api/admin/members", roles: ["ADMIN"] },
  { prefix: "/api/admin/exports", roles: ["ADMIN"] },
  { prefix: "/api/admin/expenses", roles: ["ADMIN"] },
  { prefix: "/api/admin/finance", roles: ["ADMIN"] },
  { prefix: "/api/admin/customer-options", roles: ["EMPLOYEE", "ADMIN"] },
  { prefix: "/api/admin/package-catalog", roles: ["EMPLOYEE", "ADMIN"] },
  { prefix: "/api/admin/storefront-catalog", roles: ["EMPLOYEE", "ADMIN"] },
  { prefix: "/api/admin/package-sales", roles: ["EMPLOYEE", "ADMIN"] },
  { prefix: "/api/admin/pickup-confirmations", roles: ["EMPLOYEE", "ADMIN"] },
  { prefix: "/api/admin/service-orders", roles: ["EMPLOYEE", "ADMIN"] },
  { prefix: "/api/admin/payments", roles: ["EMPLOYEE", "ADMIN"] },
  { prefix: "/api/admin/pricing", roles: ["EMPLOYEE", "ADMIN"] },
  { prefix: "/api/admin/storefront-prices", roles: ["EMPLOYEE", "ADMIN"] },
  { prefix: "/api/admin/settings", roles: ["EMPLOYEE", "ADMIN"] },
  { prefix: "/api/admin/dashboard", roles: ["EMPLOYEE", "ADMIN"] },
  { prefix: "/api/admin/staff-options", roles: ["EMPLOYEE", "ADMIN"] },
  // Example when you add member APIs:
  // { prefix: "/api/member", roles: ["USER", "EMPLOYEE", "ADMIN"], requireMember: true },
];

const getAccessPolicy = (pathname: string): AccessPolicy | null => {
  let matched: AccessPolicy | null = null;
  for (const policy of ACCESS_POLICIES) {
    const isMatch = pathname === policy.prefix || pathname.startsWith(`${policy.prefix}/`);
    if (!isMatch) continue;

    // Prefer the most specific (longest) prefix when policies overlap.
    if (!matched || policy.prefix.length > matched.prefix.length) {
      matched = policy;
    }
  }
  return matched;
}

export default defineEventHandler(async (event) => {
  try {
    const context = event.context as typeof event.context & { user?: User; session?: SessionWithUser };
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(event.node.req.headers)) {
      if (value === undefined) continue;
      headers[key] = Array.isArray(value) ? value.join(",") : value;
    }

    const session = await auth.api.getSession({
      headers,
    });

    if (!session?.user) {
      context.session = null;
    }

    if (session?.user) {
      const sessionUser = session.user as User & { deletedAt?: Date | string | null; isActive?: boolean };
      const freshUser = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: {
          id: true,
          role: true,
          isActive: true,
          deletedAt: true,
        },
      });
      const u = {
        ...sessionUser,
        role: freshUser?.role ?? sessionUser.role,
        isActive: freshUser?.isActive ?? sessionUser.isActive,
        deletedAt: freshUser?.deletedAt ?? sessionUser.deletedAt,
      };
      if (u.deletedAt) {
        await prisma.session.deleteMany({ where: { userId: u.id } });
        deleteCookie(event, "better-auth.session_token");
        deleteCookie(event, "__Secure-better-auth.session_token");
        context.session = null;
        setCookie(event, "auth_signout_reason", "deleted", {
          path: "/",
          maxAge: 60,
          sameSite: "lax",
        });
      } else if (u.isActive === false) {
        // Inactive users can still access /me, /auth, and public routes
        // but are blocked from admin/* and /api/admin/* paths
        const pathname = getRequestURL(event).pathname;
        if (pathname.startsWith("/api/admin")) {
          throw createError({
            statusCode: 403,
            statusMessage: "บัญชีนี้ถูกพักการใช้งาน",
          });
        }
        if (pathname.startsWith("/admin")) {
          setCookie(event, "auth_signout_reason", "inactive", {
            path: "/",
            maxAge: 60,
            sameSite: "lax",
          });
          return sendRedirect(event, "/me", 302);
          // Don't set user in context — they're still logged in
          // but admin middleware will reject them
        } else {
          context.user = u;
          context.session = { ...session, user: u } as unknown as SessionWithUser;
        }
      } else {
        context.user = u;
        context.session = { ...session, user: u } as unknown as SessionWithUser;
      }
    }
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error("[auth-session middleware] Failed to load session", error);
  }

  const accessPolicy = getAccessPolicy(getRequestURL(event).pathname);
  if (accessPolicy?.roles?.length) {
    requireRole(event, accessPolicy.roles);
  }
  if (accessPolicy?.requireMember) {
    await requireMember(event);
  }
});
