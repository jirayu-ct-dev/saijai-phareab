import { authClient } from "~~/app/utils/auth-client";
import type { Role } from "~~/shared/types/enums";

type SessionUserWithRole = {
  role?: Role;
};

export default defineNuxtRouteMiddleware(async () => {
  const { data: session } = await authClient.useSession(useFetch);

  if (!session.value?.user) {
    return navigateTo("/auth/login");
  }

  const role = (session.value.user as SessionUserWithRole).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") {
    return navigateTo("/");
  }
});
