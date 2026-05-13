import type { Role } from "~~/shared/types/enums";

type SessionUserWithRole = {
  role?: Role;
  isActive?: boolean;
};

export default defineNuxtRouteMiddleware(async () => {
  const authSession = useState<unknown | null>("auth:session", () => null);
  const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;
  const session = await $fetch<any>("/api/auth/session-status", { headers });

  if (!session?.user) {
    authSession.value = null;
    return navigateTo("/auth/login");
  }

  authSession.value = session;
  const user = session.user as SessionUserWithRole;
  if (user.isActive === false) {
    return navigateTo("/me");
  }

  const role = user.role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") {
    return navigateTo("/");
  }
});
