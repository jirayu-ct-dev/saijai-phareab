import { authClient } from "~~/app/utils/auth-client";
import type { Role } from "~~/shared/types/enums";

type SessionUserWithRole = {
  role?: Role;
};

export default defineNuxtRouteMiddleware(async () => {
  const authSession = useState<any | null>("auth:session");
  const session = authSession.value;

  if (!session?.user) {
    return navigateTo("/auth/login");
  }

  const role = (session.user as SessionUserWithRole).role;

  if (role === "ADMIN" || role === "EMPLOYEE") {
    return navigateTo("/admin");
  }

  if (role !== "USER") {
    return navigateTo("/");
  }
});
