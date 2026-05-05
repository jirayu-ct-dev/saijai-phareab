import type { Session as AppSession, User as AppUser } from "~~/shared/types/auth";

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
    const { data, error } = await authClient.useSession(useFetch);

    if (!error.value) {
      session.value = (data.value as SessionWithUser) ?? null;
    }

    return session.value;
  };

  const redirectByRole = async (role?: string) => {
    if (role === 'ADMIN') return navigateTo('/admin')
    if (role === 'EMPLOYEE') return navigateTo('/admin/employee-dashboard')
    if (role === 'USER') return navigateTo('/me')
    return navigateTo('/auth/login')
  }

  const login = async (email: string, password: string) => {
    start();
    try {
      const { data, error } = await authClient.signIn.email({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message || "เข้าสู่ระบบไม่สำเร็จ");
      }

      if (!data) {
        throw new Error("ไม่พบข้อมูลผู้ใช้งาน");
      }

      await refreshSession();
      notify.success("เข้าสู่ระบบสำเร็จ");
      console.log("user login data:", user);

      // Redirect based on role
      await redirectByRole(user.value?.role);
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

      if (!data) {
        throw new Error("ไม่พบข้อมูลผู้ใช้งาน");
      }

      console.log("user login data:", user);


      // Redirect based on role
      await redirectByRole(user.value?.role);

    } catch (error: any) {
      console.error(error);
      throw new Error(error.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย LINE");
    } finally {
      finish();
    }
  };

  const loginWithLineIdToken = async (accessToken: string, idToken: string) => {
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
