import type { Session as AppSession, User as AppUser } from "~~/shared/types/auth";
import { clearSessionStatusCache, fetchSessionStatus } from "~/utils/session-status";

type SessionWithUser = (AppSession & { user?: AppUser }) | null;

export const useUser = () => {
  const notify = useNotify();
  const { start, finish } = useLoadingIndicator();
  const router = useRouter();

  // ใช้ state กลางสำหรับ session เพื่อให้ SSR กับ client ได้ข้อมูลชุดเดียวกัน
  const session = useState<SessionWithUser>("auth:session", () => null);
  const user = computed(() => session.value?.user as AppUser | undefined);

  const userAvatar = computed(() => ({
    as: { img: "img" },
    src: user.value?.image || "",
    alt: user.value?.name || "ผู้ใช้งาน",
    loading: "lazy" as const,
  }));

  const refreshSession = async () => {
    clearSessionStatusCache();
    session.value = await fetchSessionStatus({ force: true });

    return session.value;
  };

  const redirectByRole = async (role?: string) => {
    if (user.value?.isActive === false && (role === "ADMIN" || role === "EMPLOYEE")) {
      return navigateTo("/me");
    }
    if (role === 'ADMIN') return navigateTo('/admin')
    if (role === 'EMPLOYEE') return navigateTo('/admin/employee-dashboard')
    if (role === 'USER') return navigateTo('/me')
    return navigateTo('/auth/login')
  }

  const login = async (email: string, password: string, rememberMe?: boolean) => {
    start();
    try {
      const { data, error } = await authClient.signIn.email({
        email,
        password,
        rememberMe,
      });

      if (error) {
        throw new Error(error.message || "เข้าสู่ระบบไม่สำเร็จ");
      }

      if (!data) {
        throw new Error("ไม่พบข้อมูลผู้ใช้งาน");
      }

      const refreshedSession = await refreshSession();
      notify.success("เข้าสู่ระบบสำเร็จ");

      // Keep redirect ownership here. The login page must not also watch the
      // shared session and start a competing navigation.
      await redirectByRole(refreshedSession?.user?.role ?? (data.user as AppUser).role);
    } catch (error: any) {
      console.error(error);
      notify.error(error.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
      throw error;
    } finally {
      finish();
    }
  };

  const register = async (name: string, email: string, password: string) => {
    start();
    try {
      const { data, error } = await authClient.signUp.email({
        name,
        email,
        password,
        role: "USER",
      } as Parameters<typeof authClient.signUp.email>[0] & { role: "USER" });

      if (error) {
        throw new Error(error.message || "สมัครสมาชิกไม่สำเร็จ");
      }

      if (!data) {
        throw new Error("ไม่พบข้อมูลผู้ใช้งาน");
      }

      await refreshSession();
      notify.success("สมัครสมาชิกสำเร็จ");
      await redirectByRole(user.value?.role);
    } catch (error: any) {
      console.error(error);
      throw new Error(error.message || "เกิดข้อผิดพลาดในการสมัครสมาชิก");
    } finally {
      finish();
    }
  };

  const loginWithLine = async () => {
    start();
    try {
      const { data, error } = await authClient.signIn.social({
        provider: "line",
        callbackURL: "/",
      });

      if (error) {
        throw new Error(error.message || "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ");
      }
      
      // การทำ Social Login จะทำให้เบราว์เซอร์สลับหน้าไปที่ Provider (LINE) ทันที
      // จึงไม่ควรเขียนโค้ดที่ต้องการประมวลผลต่อหลังจากบรรทัดนี้ เพราะอาจไม่ถูกเรียกหรือเกิดข้อผิดพลาด

    } catch (error: any) {
      console.error(error);
      throw new Error(error.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย LINE");
    } finally {
      finish();
    }
  };

  const loginWithLineIdToken = async (accessToken: string, idToken: string, displayName?: string) => {
    start();
    try {
      const { data, error } = await authClient.signIn.social({
        provider: "line",
        idToken: {
          token: idToken,
          accessToken,
        },
        callbackURL: "/",
        newUserCallbackURL: "/",
        errorCallbackURL: "/auth/login",
        disableRedirect: true,
      });

      if (error) {
        throw new Error(error.message || "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ");
      }

      if (!data) {
        throw new Error("ไม่พบข้อมูลผู้ใช้งาน");
      }

      await refreshSession();

      // Sync name if it's the placeholder "liff-auto login" or empty
      if (user.value && (user.value.name === "liff-auto login" || !user.value.name) && displayName) {
        try {
          await $fetch("/api/me/profile", {
            method: "PUT",
            body: { name: displayName },
          });
          await refreshSession();
        } catch (e) {
          console.error("[useUser] Failed to sync LIFF name:", e);
        }
      }
    } catch (error: any) {
      console.error(error);
      throw new Error(error.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย LINE");
    } finally {
      finish();
    }
  };

  const logout = async () => {
    start();
    try {
      await authClient.signOut();
      clearSessionStatusCache();
      session.value = null;
    } catch (error: any) {
      console.error(error);
      throw new Error(error.message || "ออกจากระบบไม่สำเร็จ");
    } finally {
      finish();
    }
  };

  return {
    session,
    user,
    userAvatar,
    refreshSession,
    login,
    register,
    loginWithLine,
    loginWithLineIdToken,
    logout,
    redirectByRole,
  };
};
