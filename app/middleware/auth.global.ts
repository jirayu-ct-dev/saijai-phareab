import { authClient } from "~~/app/utils/auth-client";

export default defineNuxtRouteMiddleware(async (to) => {
  const authSession = useState<unknown | null>("auth:session", () => null);
  const publicRoutes = ["/", "/auth/login", "/auth/register"];
  if (publicRoutes.includes(to.path)) {
    // If user is already logged in and trying to access login/register, redirect them by role
    if (to.path === "/auth/login" || to.path === "/auth/register") {
      const { data: session } = await authClient.useSession(useFetch);
      if (session.value?.user) {
        const role = (session.value.user as any).role;
        if (role === "ADMIN") return navigateTo("/admin");
        if (role === "EMPLOYEE") return navigateTo("/admin/employee-dashboard");
        if (role === "USER") return navigateTo("/me");
      }
    }
    return;
  }

  const { data: session, error } = await authClient.useSession(useFetch);
  if (!error.value && session.value?.user) {
    authSession.value = session.value;
    return;
  }

  authSession.value = null;

  if (import.meta.client) {
    const { ensureLiffSession } = useLiffAuth();
    const restored = await ensureLiffSession();

    if (restored) {
      const { data: refreshedSession, error: refreshedError } = await authClient.useSession(useFetch);
      if (!refreshedError.value && refreshedSession.value?.user) {
        authSession.value = refreshedSession.value;
        return;
      }
    }
  }

  return navigateTo("/auth/login");
});
