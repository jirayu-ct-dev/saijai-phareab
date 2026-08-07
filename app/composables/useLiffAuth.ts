import type { Liff } from '@line/liff'
import { isPotentialLiffLaunch } from '~~/shared/utils/liff'

type LiffAutoLoginResult = 'logged-in' | 'redirecting' | 'skipped' | 'failed'

const LIFF_LAUNCH_STORAGE_KEY = 'liff:launch-context'
let pendingAutoLogin: Promise<LiffAutoLoginResult> | null = null

export const useLiffAuth = () => {
    const { $liff } = useNuxtApp()
    const { loginWithLineIdToken, session } = useUser()

    const addLineFriend = useState<boolean>('liff:add-line-friend', () => false)
    const lastAutoLoginResult = useState<LiffAutoLoginResult | null>('liff:auto-login-result', () => null)

    const detectPotentialLiffClient = () => {
        if (!import.meta.client) {
            return false
        }

        const persistedLaunch = window.sessionStorage.getItem(LIFF_LAUNCH_STORAGE_KEY) === '1'
        return isPotentialLiffLaunch(
            window.navigator.userAgent || '',
            window.location.href,
            persistedLaunch
        )
    }

    const performLiffAutoLogin = async (): Promise<LiffAutoLoginResult> => {
        if (session.value?.user) {
            return 'skipped'
        }

        if (!import.meta.client) {
            return 'skipped'
        }

        if (!detectPotentialLiffClient()) {
            return 'skipped'
        }

        try {
            const liff = (await $liff) as Liff | undefined

            if (!liff) {
                return 'failed'
            }

            const isInLiffClient = liff.isInClient()

            if (!liff.isLoggedIn()) {
                if (isInLiffClient) {
                    // liff.init() performs login inside the LIFF browser. LINE
                    // explicitly does not support calling liff.login() there.
                    return 'failed'
                }

                liff.login({ redirectUri: window.location.href })
                return 'redirecting'
            }

            const idToken = liff.getIDToken()
            const accessToken = liff.getAccessToken()

            if (!idToken || !accessToken) {
                return 'failed'
            }

            let displayName: string | undefined
            try {
                displayName = liff.getDecodedIDToken()?.name ?? (await liff.getProfile()).displayName
            } catch (profileError) {
                console.warn('[useLiffAuth] Unable to read optional LINE profile', profileError)
            }

            await loginWithLineIdToken(accessToken, idToken, displayName)

            try {
                const isFriend = await liff.getFriendship()
                addLineFriend.value = isFriend.friendFlag
            } catch (friendshipError) {
                console.error("[useLiffAuth] Failed to check LINE friendship:", friendshipError)
                addLineFriend.value = false
            }

            return 'logged-in'
        }
        catch (error: any) {
            console.error(error)
            return 'failed'
        }
    }

    const ensureLiffSession = (): Promise<LiffAutoLoginResult> => {
        if (session.value?.user) return Promise.resolve('skipped')
        if (lastAutoLoginResult.value) {
            return Promise.resolve(lastAutoLoginResult.value)
        }
        if (pendingAutoLogin) return pendingAutoLogin

        pendingAutoLogin = performLiffAutoLogin()
            .then((result) => {
                lastAutoLoginResult.value = result
                return result
            })
            .finally(() => {
                pendingAutoLogin = null
            })

        return pendingAutoLogin
    }

    return {
        addLineFriend,
        ensureLiffSession
    }
}
