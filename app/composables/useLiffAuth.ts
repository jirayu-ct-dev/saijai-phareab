import type { Liff } from '@line/liff'

export const useLiffAuth = () => {
    const { $liff } = useNuxtApp()
    const notify = useNotify()
    const { loginWithLineIdToken } = useUser()

    const addLineFriend = ref(false)

    // Function
    const handleLiffAutoLogin = async () => {
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
                    notify.error("ไม่พบข้อมูล ID Token หรือ Access Token")
                    return
                }

                await loginWithLineIdToken(accessToken, idToken)

                const isFriend = await liff.getFriendship()
                addLineFriend.value = isFriend.friendFlag

                notify.success(addLineFriend.value ? "เข้าสู่ระบบสำเร็จ! และเพิ่ม LINE เพื่อนแล้ว" : "เข้าสู่ระบบสำเร็จ!")
            }
        }
        catch (error: any) {
            console.error(error)
            notify.error("LIFF Error: " + (error.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ LINE"))
        }
    }

    return {
        addLineFriend,
        handleLiffAutoLogin
    }
}
