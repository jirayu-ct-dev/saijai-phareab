import type { User as AppUser } from "~~/shared/types/auth";

export const useUser = () => {
    const notify = useNotify()
    const { start, finish } = useLoadingIndicator()

    // 1. ดึง Session อัตโนมัติจาก better-auth
    const sessionRef = authClient.useSession();

    // 2. แปลงเป็น Computed ให้ใช้งานง่ายขึ้น
    const session = computed(() => sessionRef.value.data);
    const user = computed(() => sessionRef.value.data?.user as AppUser | undefined);

    // console.log("user: ", user)

    // 3. ตัวช่วยสร้าง Object สำหรับรูป Avatar จากแหล่งภายนอก (เช่น LINE) แก้ปัญหาแครชกับ Cloudinary
    const userAvatar = computed(() => {
        const u = user.value;

        return {
            as: { img: 'img' },
            src: u && u.image ? u.image : '',
            alt: u && u.name ? u.name : 'ผู้ใช้งาน',
            loading: 'lazy' as const,
        };
    });


    const login = async (email: string, password: string) => {
        start()
        try {
            const { data, error } = await authClient.signIn.email({
                email,
                password
            })

            if (error) {
                throw new Error(error.message || 'เข้าสู่ระบบไม่สำเร็จ')
            }

            if (!data) {
                throw new Error('ไม่พบข้อมูลผู้ใช้')
            }

            notify.success("เข้าสู่ระบบสำเร็จ!")
        }
        catch (error: any) {
            console.error(error)
            notify.error(error.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ')
            throw error // โยน error ดั้งเดิมออกไป ถ้าหน้าบ้านไม่ได้ใช้งาน
        }
        finally {
            finish()
        }
    }

    const register = async (name: string, email: string, password: string) => {
        start()
        try {
            const { data, error } = await authClient.signUp.email({
                name,
                email,
                password
            })

            if (error) {
                throw new Error(error.message || 'สมัครสมาชิกไม่สำเร็จ')
            }

            if (!data) {
                throw new Error('ไม่พบข้อมูลผู้ใช้')
            }

        }
        catch (error: any) {
            console.error(error)
            throw new Error(error.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก')
        }
        finally {
            finish()
        }
    }

    const loginWithLine = async () => {
        start()
        try {
            const { data, error } = await authClient.signIn.social({
                provider: "line",
                callbackURL: "/"
            })

            if (error) {
                throw new Error(error.message || 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ')
            }

            if (!data) {
                throw new Error('ไม่พบข้อมูลผู้ใช้')
            }
        }
        catch (error: any) {
            console.error(error)
            throw new Error(error.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย LINE')
        }
        finally {
            finish()
        }
    }

    const loginWithLineIdToken = async (accessToken: string, idToken: string) => {
        start()
        try {
            const { data, error } = await authClient.signIn.social({
                provider: "line",
                idToken: {
                    token: idToken,
                    accessToken: accessToken
                },
                callbackURL: "/",
                newUserCallbackURL: "/",
                errorCallbackURL: "/auth/login",
                disableRedirect: true
            })

            if (error) {
                throw new Error(error.message || 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ')
            }

            if (!data) {
                throw new Error('ไม่พบข้อมูลผู้ใช้')
            }

        }
        catch (error: any) {
            console.error(error)
            throw new Error(error.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย LINE')
        }
        finally {
            finish()
        }
    }

    const logout = async () => {
        start()
        try {
            await authClient.signOut()
        }
        catch (error: any) {
            console.error(error)
            throw new Error(error.message || 'ออกจากระบบไม่สำเร็จ')
        }
        finally {
            finish()
        }
    }

    return {
        session,
        user,
        userAvatar,
        login,
        register,
        loginWithLine,
        loginWithLineIdToken,
        logout
    }
}

