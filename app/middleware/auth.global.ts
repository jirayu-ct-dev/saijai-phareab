export default defineNuxtRouteMiddleware((to) => {
  const { session } = useUser();

  // หน้าสาธารณะ (ไม่ต้อง login)
  const publicRoutes = ["/", "/auth/login", "/auth/register"];

  if (publicRoutes.includes(to.path)) {
    return;
  }

  // ถ้า session ยังไม่ได้โหลด ใช้ pending state จาก better-auth (ถ้ามี)
  if (!session.value?.user) {
    return navigateTo("/auth/login");
  }
})

