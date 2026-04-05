import { authClient } from "~~/app/utils/auth-client";
import type { Role } from "~~/shared/types/enums";

type SessionUserWithRole = {
  role?: Role;
};

export default defineNuxtRouteMiddleware(async () => {
  const authSession = useState<unknown | null>("auth:session", () => null);
  const { data: session } = await authClient.useSession(useFetch);

  if (!session.value?.user) {
    authSession.value = null;
    return navigateTo("/auth/login");
  }

  authSession.value = session.value;
  const role = (session.value.user as SessionUserWithRole).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") {
    return navigateTo("/");
  }
});
