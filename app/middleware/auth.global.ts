import type { SessionUser } from "~~/app/utils/session-status";
import { getSafeInternalRedirect } from "~~/shared/utils/authNavigation";

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
    "/auth/claim-customer",
    "/terms",
    "/privacy",
  ];

  // Force a fresh session check first so the server can wipe a deleted user's session and set the signout-reason cookie.
  let session = await fetchSessionStatus();
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
  if (session?.user && session.user.isActive === false) {
    if (to.path.startsWith("/admin")) {
      if (import.meta.client) {
        window.location.href = "/me";
        return;
      }
      return navigateTo("/me");
    }
    // On login page, redirect inactive employee to /me instead of admin
    if (to.path === "/auth/login" || to.path === "/auth/register") {
      authSession.value = session;
      // Don't redirect to admin — let them stay and see notification
      return;
    }
  }

  // A claim token must be consumed before LINE creates or selects another User.
  // In particular, links are commonly opened inside the LIFF browser, where the
  // normal auto-login would otherwise run before this public route is handled.
  const shouldSkipLiffAutoLogin = to.path === "/auth/claim-customer";
  if (!session?.user && import.meta.client && !shouldSkipLiffAutoLogin) {
    const { ensureLiffSession } = useLiffAuth();
    const liffResult = await ensureLiffSession();

    if (liffResult === "redirecting") return;
    if (liffResult === "logged-in") {
      session = await fetchSessionStatus({ force: true });
    }
  }

  if (publicRoutes.includes(to.path)) {
    authSession.value = session ?? null;
    if (to.path === "/auth/login" || to.path === "/auth/register") {
      if (session?.user) {
        const returnTo = getSafeInternalRedirect(to.query.redirect);
        if (returnTo && returnTo !== to.fullPath) return navigateTo(returnTo);

        const role = (session.user as SessionUser).role;
        if (role === "ADMIN") return navigateTo("/admin");
        if (role === "EMPLOYEE") return navigateTo("/admin/employee-dashboard");
        if (role === "USER") return navigateTo("/me");
      }
    }
    return;
  }

  if (session?.user) {
    authSession.value = session;
    return;
  }

  authSession.value = null;
  const loginPath = `/auth/login?redirect=${encodeURIComponent(to.fullPath)}`;

  if (import.meta.client) {
    window.location.href = loginPath;
    return;
  }
  return navigateTo(loginPath);
});
