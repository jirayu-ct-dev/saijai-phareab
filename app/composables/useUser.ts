export const useUser = () => {
    const notify = useNotify()
    const user = useState<User | null>('user', () => null);
    const { start, finish } = useLoadingIndicator()

    const getCurrentUser = async () => {
        start()
        try {
            const session = await authClient.getSession({
                fetchOptions: {
                    headers: useRequestHeaders(['cookie'])
                }
            })

            if (session.error || !session.data) {
                user.value = null
                return
            }

            user.value = session.data.user as User
        }
        catch (error) {
            console.error(error)
            user.value = null
        }
        finally {
            finish()
        }
    }

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
            await getCurrentUser()
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

            await getCurrentUser()
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

            await getCurrentUser()
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
                errorCallbackURL: "/login" // ถ้ามีผิดพลาด
            })

            if (error) {
                throw new Error(error.message || 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ')
            }

            if (!data) {
                throw new Error('ไม่พบข้อมูลผู้ใช้')
            }

            await getCurrentUser()
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
            user.value = null
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
        user,
        getCurrentUser,
        login,
        register,
        loginWithLine,
        loginWithLineIdToken,
        logout
    }
}