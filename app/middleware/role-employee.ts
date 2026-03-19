export default defineNuxtRouteMiddleware(() => {
  const { user } = useUser();

  if (!user.value) {
    return navigateTo("/auth/login");
  }

  if (user.value.role !== "EMPLOYEE" && user.value.role !== "ADMIN") {
    return navigateTo("/");
  }
})

