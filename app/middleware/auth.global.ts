import { authClient } from "~~/app/utils/auth-client";

export default defineNuxtRouteMiddleware(async (to) => {
  const authSession = useState<unknown | null>("auth:session", () => null);
  const publicRoutes = ["/", "/auth/login", "/auth/register"];
  if (publicRoutes.includes(to.path)) return;

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
