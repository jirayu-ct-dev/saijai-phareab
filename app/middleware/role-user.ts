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

  if ((role === "ADMIN" || role === "EMPLOYEE") && user.isActive !== false) {
    return navigateTo("/admin");
  }

  if ((role === "ADMIN" || role === "EMPLOYEE") && user.isActive === false) {
    return;
  }

  if (role !== "USER") {
    return navigateTo("/");
  }
});
