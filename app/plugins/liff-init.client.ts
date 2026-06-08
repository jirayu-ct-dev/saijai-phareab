// app/plugins/liff-init.client.ts
import liff from '@line/liff'

// เก็บสถานะการ init ไว้ที่ระดับ module
let isInitialized = false
let liffPromise: Promise<typeof liff | undefined> | undefined

const isPotentialLiffClient = () => {
    if (!import.meta.client) return false
    const userAgent = window.navigator.userAgent || ''
    return /\bLine\/|\bLIFF\b/i.test(userAgent)
}

export default defineNuxtPlugin((nuxtApp) => {
    const liffId = useRuntimeConfig().public.liffId as string
    if (!liffId) {
        console.warn('NUXT_PUBLIC_LIFF_ID is missing')
        nuxtApp.provide('liff', undefined)
        return
    }

    if (!isPotentialLiffClient()) {
        nuxtApp.provide('liff', undefined)
        return
    }

    liffPromise ||= (async () => {
        if (isInitialized) return liff
        try {
            await liff.init({ liffId })
            isInitialized = true
            return liff
        } catch (error) {
            console.error('LIFF initialization failed', error)
            return undefined
        }
    })()

    // provide ให้เรียกใช้ได้ผ่าน useNuxtApp().$liff
    nuxtApp.provide('liff', liffPromise)

})
