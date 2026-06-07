export default defineNuxtRouteMiddleware(async () => {
  const authSession = useState<unknown | null>("auth:session", () => null);
  const session = await fetchSessionStatus();

  if (!session?.user) {
    authSession.value = null;
    return navigateTo("/auth/login");
  }

  authSession.value = session;
  const user = session.user;
  const role = user.role;

  // ADMIN / EMPLOYEE can access /me for their own laundry
  // (active or inactive — inactive still blocked from /admin by role-admin.ts)
  if (role === "ADMIN" || role === "EMPLOYEE") {
    return;
  }

  if (role !== "USER") {
    return navigateTo("/");
  }
});
