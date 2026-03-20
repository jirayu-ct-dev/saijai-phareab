import type { Liff } from '@line/liff'

export const useLiffAuth = () => {
    const { $liff } = useNuxtApp()
    const notify = useNotify()
    const { loginWithLineIdToken, session } = useUser()

    const addLineFriend = ref(false)
    const isAutoLoginProcessing = ref(false)

    // Function
    const handleLiffAutoLogin = async () => {
        if (isAutoLoginProcessing.value || session.value?.user) {
            return
        }

        isAutoLoginProcessing.value = true

        try {
            const liff = (await $liff) as Liff | undefined

            if (!liff) return

            const isClient = liff.isInClient()
            if (isClient) {
                if (!liff.isLoggedIn()) {
                    liff.login()
                    return
                }

                const idToken = liff.getIDToken()
                const accessToken = liff.getAccessToken()

                if (!idToken || !accessToken) {
                    notify.error("ไม่สามารถเข้าสู่ระบบด้วย LINE ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง")
                    return
                }

                await loginWithLineIdToken(accessToken, idToken)

                const isFriend = await liff.getFriendship()
                addLineFriend.value = isFriend.friendFlag

                notify.success(
                    addLineFriend.value
                        ? "เข้าสู่ระบบเรียบร้อยแล้ว และเพิ่มเพื่อน LINE สำเร็จ"
                        : "เข้าสู่ระบบเรียบร้อยแล้ว"
                )
            }
        }
        catch (error: any) {
            console.error(error)
            notify.error(error?.message || "ขออภัย เกิดปัญหาในการเชื่อมต่อ LINE กรุณาลองใหม่อีกครั้ง")
        } finally {
            isAutoLoginProcessing.value = false
        }
    }

    return {
        addLineFriend,
        handleLiffAutoLogin
    }
}
