import { authClient } from "~~/app/utils/auth-client";

export default defineNuxtRouteMiddleware(async (to) => {
  const publicRoutes = ["/", "/auth/login", "/auth/register"];
  if (publicRoutes.includes(to.path)) return;

  const { data: session, error } = await authClient.useSession(useFetch);
  if (error.value || !session.value?.user) {
    return navigateTo("/auth/login");
  }
});
