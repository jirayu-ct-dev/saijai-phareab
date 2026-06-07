export default defineNuxtRouteMiddleware(async () => {
  const authSession = useState<unknown | null>("auth:session", () => null);
  const session = await fetchSessionStatus();

  if (!session?.user) {
    authSession.value = null;
    return navigateTo("/auth/login");
  }

  authSession.value = session;
  const user = session.user;
  if (user.isActive === false) {
    return navigateTo("/me");
  }

  const role = user.role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") {
    return navigateTo("/");
  }
});
