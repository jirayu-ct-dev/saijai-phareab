import { authClient } from "~~/app/utils/auth-client";

const fetchFreshSession = async () => {
  try {
    const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;
    return await $fetch<any>("/api/auth/get-session", { headers });
  } catch {
    return null;
  }
};

export default defineNuxtRouteMiddleware(async (to) => {
  const authSession = useState<unknown | null>("auth:session", () => null);
  const publicRoutes = ["/", "/auth/login", "/auth/register"];

  // Force a fresh session check first so the server can wipe a deleted user's session and set the signout-reason cookie.
  const preflight = await fetchFreshSession();
  const signoutReason = useCookie<string | null>("auth_signout_reason").value;
  if (signoutReason === "deleted" && to.path !== "/auth/login") {
    if (import.meta.client) {
      window.location.href = "/auth/login";
      return;
    }
    return navigateTo("/auth/login");
  }

  if (publicRoutes.includes(to.path)) {
    if (to.path === "/auth/login" || to.path === "/auth/register") {
      const session = preflight;
      if (session?.user) {
        authSession.value = session;
        const role = (session.user as any).role;
        if (role === "ADMIN") return navigateTo("/admin");
        if (role === "EMPLOYEE") return navigateTo("/admin/employee-dashboard");
        if (role === "USER") return navigateTo("/me");
      } else {
        authSession.value = null;
      }
    }
    return;
  }

  const session = preflight;
  if (session?.user) {
    authSession.value = session;
    return;
  }

  authSession.value = null;

  if (import.meta.client) {
    const { ensureLiffSession } = useLiffAuth();
    const restored = await ensureLiffSession();

    if (restored) {
      const refreshed = await fetchFreshSession();
      if (refreshed?.user) {
        authSession.value = refreshed;
        return;
      }
    }
  }

  if (import.meta.client) {
    window.location.href = "/auth/login";
    return;
  }
  return navigateTo("/auth/login");
});
