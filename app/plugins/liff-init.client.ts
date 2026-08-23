// app/plugins/liff-init.client.ts
import liff from '@line/liff'
import { isPotentialLiffLaunch } from '~~/shared/utils/liff'
import { stripLiffTokensFromUrl } from '~/utils/liff-url'

let isInitialized = false
let liffPromise: Promise<typeof liff | undefined> | undefined
const LIFF_LAUNCH_STORAGE_KEY = 'liff:launch-context'

export default defineNuxtPlugin((nuxtApp) => {
    const liffId = useRuntimeConfig().public.liffId as string
    if (!liffId) {
        console.warn('NUXT_PUBLIC_LIFF_ID is missing')
        nuxtApp.provide('liff', undefined)
        return
    }

    const persistedLaunch = window.sessionStorage.getItem(LIFF_LAUNCH_STORAGE_KEY) === '1'
    const isLiffLaunch = isPotentialLiffLaunch(
        window.navigator.userAgent || '',
        window.location.href,
        persistedLaunch
    )

    if (!isLiffLaunch) {
        nuxtApp.provide('liff', undefined)
        return
    }

    window.sessionStorage.setItem(LIFF_LAUNCH_STORAGE_KEY, '1')

    liffPromise ||= (async () => {
        if (isInitialized) return liff
        try {
            await liff.init({ liffId, withLoginOnExternalBrowser: false })
            isInitialized = true
            // init() has consumed any tokens returned in the URL hash after a
            // liff.login() redirect; clear them so they cannot leak onward.
            stripLiffTokensFromUrl()
            return liff
        } catch (error) {
            console.error('LIFF initialization failed', error)
            return undefined
        }
    })()

    // provide ให้เรียกใช้ได้ผ่าน useNuxtApp().$liff
    nuxtApp.provide('liff', liffPromise)

})
