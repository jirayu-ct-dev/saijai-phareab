import { auth } from "~~/app/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { requireMember, requireRole } from "~~/server/utils/auth";
import type { User } from "~~/shared/types/auth";
import type { Role } from "~~/shared/types/enums";

type AccessPolicy = {
  prefix: string;
  roles?: Role[];
  requireMember?: boolean;
};

const ACCESS_POLICIES: AccessPolicy[] = [
  { prefix: "/api/admin/users", roles: ["ADMIN"] },
  { prefix: "/api/admin/packages", roles: ["ADMIN"] },
  { prefix: "/api/admin/customer-options", roles: ["EMPLOYEE", "ADMIN"] },
  { prefix: "/api/admin/package-catalog", roles: ["EMPLOYEE", "ADMIN"] },
  { prefix: "/api/admin/storefront-catalog", roles: ["EMPLOYEE", "ADMIN"] },
  { prefix: "/api/admin/package-sales", roles: ["EMPLOYEE", "ADMIN"] },
  { prefix: "/api/admin/service-orders", roles: ["EMPLOYEE", "ADMIN"] },
  { prefix: "/api/admin/payments", roles: ["EMPLOYEE", "ADMIN"] },
  { prefix: "/api/admin/pricing", roles: ["EMPLOYEE", "ADMIN"] },
  { prefix: "/api/admin/storefront-prices", roles: ["EMPLOYEE", "ADMIN"] },
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
    const context = event.context as typeof event.context & { user?: User };
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(event.node.req.headers)) {
      if (value === undefined) continue;
      headers[key] = Array.isArray(value) ? value.join(",") : value;
    }

    const session = await auth.api.getSession({
      headers,
    });

    if (session?.user) {
      const u = session.user as User & { deletedAt?: Date | string | null };
      if (u.deletedAt) {
        await prisma.session.deleteMany({ where: { userId: u.id } });
        deleteCookie(event, "better-auth.session_token");
        deleteCookie(event, "__Secure-better-auth.session_token");
        setCookie(event, "auth_signout_reason", "deleted", {
          path: "/",
          maxAge: 60,
          sameSite: "lax",
        });
      } else {
        context.user = u;
      }
    }
  } catch (error) {
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
