// app/plugins/liff-init.client.ts
import liff from '@line/liff'

// เก็บสถานะการ init ไว้ที่ระดับ module
let isInitialized = false

export default defineNuxtPlugin(async (nuxtApp) => {
    const liffId = useRuntimeConfig().public.liffId as string
    if (!liffId) {
        console.warn('NUXT_PUBLIC_LIFF_ID is missing')
        nuxtApp.provide('liff', undefined)
        return
    }

    // ตรวจสอบว่าได้ init แล้วหรือยัง
    if (!isInitialized) {
        try {
            await liff.init({ liffId })
            isInitialized = true
        } catch (error) {
            console.error('LIFF initialization failed', error)
            nuxtApp.provide('liff', undefined)
            return
        }
    }

    // provide ให้เรียกใช้ได้ผ่าน useNuxtApp().$liff
    nuxtApp.provide('liff', liff)

})
