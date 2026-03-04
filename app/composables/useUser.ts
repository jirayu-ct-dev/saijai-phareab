export const useUser = () => {
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

    const login = async (email: string, password: string): Promise<void> => {
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

            await getCurrentUser()
        }
        finally {
            finish()
        }
    }

    const register = async (name: string, email: string, password: string): Promise<void> => {
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
        finally {
            finish()
        }
    }

    const loginWithLine = async (): Promise<void> => {
        start()
        try {
            const { error } = await authClient.signIn.social({
                provider: "line",
                callbackURL: "/"
            })

            if (error) {
                throw new Error(error.message || 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ')
            }
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
        catch (error) {
            console.error(error)
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
        logout
    }
}