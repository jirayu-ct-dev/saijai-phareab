import type { SessionUser } from "~~/app/utils/session-status";

export default defineNuxtRouteMiddleware(async (to) => {
  const authSession = useState<unknown | null>("auth:session", () => null);
  const publicRoutes = [
    "/",
    "/pricing",
    "/packages",
    "/auth/login",
    "/auth/register",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/terms",
    "/privacy",
  ];

  // Force a fresh session check first so the server can wipe a deleted user's session and set the signout-reason cookie.
  const preflight = await fetchSessionStatus();
  const signoutReason = useCookie<string | null>("auth_signout_reason").value;
  if (signoutReason === "deleted" && to.path !== "/auth/login") {
    if (import.meta.client) {
      window.location.href = "/auth/login";
      return;
    }
    return navigateTo("/auth/login");
  }
  if (signoutReason === "inactive") {
    // Inactive employee — redirect to /me with notification
    if (to.path.startsWith("/admin")) {
      if (import.meta.client) {
        window.location.href = "/me";
        return;
      }
      return navigateTo("/me");
    }
  }

  // Also check isActive from session directly (catches cases where cookie hasn't been set yet)
  if (preflight?.user && preflight.user.isActive === false) {
    if (to.path.startsWith("/admin")) {
      if (import.meta.client) {
        window.location.href = "/me";
        return;
      }
      return navigateTo("/me");
    }
    // On login page, redirect inactive employee to /me instead of admin
    if (to.path === "/auth/login" || to.path === "/auth/register") {
      authSession.value = preflight;
      // Don't redirect to admin — let them stay and see notification
      return;
    }
  }

  if (publicRoutes.includes(to.path)) {
    authSession.value = preflight ?? null;
    if (to.path === "/auth/login" || to.path === "/auth/register") {
      const session = preflight;
      if (session?.user) {
        const role = (session.user as SessionUser).role;
        if (role === "ADMIN") return navigateTo("/admin");
        if (role === "EMPLOYEE") return navigateTo("/admin/employee-dashboard");
        if (role === "USER") return navigateTo("/me");
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
    const liffResult = await ensureLiffSession();

    if (liffResult === "redirecting") {
      return;
    }

    if (liffResult === "logged-in") {
      const refreshed = await fetchSessionStatus();
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
