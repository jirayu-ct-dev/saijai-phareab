import { auth } from "~~/app/utils/auth";
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
  { prefix: "/api/admin/pricing", roles: ["ADMIN"] },
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
      context.user = session.user as User;
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
