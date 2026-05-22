import type { Liff } from '@line/liff'

export const useLiffAuth = () => {
    const { $liff } = useNuxtApp()
    const notify = useNotify()
    const { loginWithLineIdToken, session } = useUser()

    const addLineFriend = useState<boolean>('liff:add-line-friend', () => false)
    const isAutoLoginProcessing = useState<boolean>('liff:auto-login-processing', () => false)
    const isLiffBootstrapping = useState<boolean>('liff:bootstrapping', () => false)
    const isPotentialLiffClient = useState<boolean>('liff:is-potential-client', () => false)
    const isInLiffClient = useState<boolean>('liff:is-in-client', () => false)
    const isLiffCheckCompleted = useState<boolean>('liff:check-completed', () => false)

    const detectPotentialLiffClient = () => {
        if (!import.meta.client) {
            return false
        }

        const userAgent = window.navigator.userAgent || ''
        return /\bLine\/|\bLIFF\b/i.test(userAgent)
    }

    const runLiffAutoLogin = async (silent = false): Promise<'logged-in' | 'redirecting' | 'skipped' | 'failed'> => {
        if (isAutoLoginProcessing.value || session.value?.user) {
            return 'skipped'
        }

        if (!import.meta.client) {
            isLiffCheckCompleted.value = true
            return 'skipped'
        }

        isPotentialLiffClient.value = detectPotentialLiffClient()

        if (!isPotentialLiffClient.value) {
            isInLiffClient.value = false
            isLiffCheckCompleted.value = true
            return 'skipped'
        }

        isAutoLoginProcessing.value = true
        isLiffBootstrapping.value = true

        try {
            const liff = (await $liff) as Liff | undefined

            if (!liff) {
                isLiffCheckCompleted.value = true
                return 'skipped'
            }

            isInLiffClient.value = liff.isInClient()
            isLiffCheckCompleted.value = true

            if (!isInLiffClient.value) {
                return 'skipped'
            }

            if (!liff.isLoggedIn()) {
                liff.login()
                return 'redirecting'
            }

            const idToken = liff.getIDToken()
            const accessToken = liff.getAccessToken()

            if (!idToken || !accessToken) {
                if (!silent) {
                    notify.error("ไม่สามารถเข้าสู่ระบบด้วย LINE ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง")
                }
                return 'failed'
            }

            const profile = await liff.getProfile();
            await loginWithLineIdToken(accessToken, idToken, profile.displayName);

            const isFriend = await liff.getFriendship()
            addLineFriend.value = isFriend.friendFlag

            if (!silent) {
                notify.success(
                    addLineFriend.value
                        ? "เข้าสู่ระบบเรียบร้อยแล้ว และเพิ่มเพื่อน LINE สำเร็จ"
                        : "เข้าสู่ระบบเรียบร้อยแล้ว"
                )
            }

            return 'logged-in'
        }
        catch (error: any) {
            console.error(error)
            if (!silent) {
                notify.error(error?.message || "ขออภัย เกิดปัญหาในการเชื่อมต่อ LINE กรุณาลองใหม่อีกครั้ง")
            }
            return 'failed'
        } finally {
            isAutoLoginProcessing.value = false
            isLiffBootstrapping.value = false
        }
    }

    const handleLiffAutoLogin = async () => {
        await runLiffAutoLogin(false)
    }

    const ensureLiffSession = async (): Promise<boolean> => {
        const result = await runLiffAutoLogin(true)
        return result === 'logged-in' || result === 'redirecting'
    }

    return {
        addLineFriend,
        handleLiffAutoLogin,
        ensureLiffSession,
        isLiffBootstrapping,
        isPotentialLiffClient,
        isInLiffClient,
        isLiffCheckCompleted
    }
}
