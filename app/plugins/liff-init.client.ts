// app/plugins/liff-init.client.ts
import liff from '@line/liff'

// เก็บสถานะการ init ไว้ที่ระดับ module
let isInitialized = false

export default defineNuxtPlugin(async (nuxtApp) => {
    const liffId = useRuntimeConfig().public.liffId as string
    if (!liffId) {
        console.warn('NUXT_PUBLIC_LIFF_ID is missing')
        throw new Error('LIFF ID is required')
    }

    // ตรวจสอบว่าได้ init แล้วหรือยัง
    if (!isInitialized) {
        console.log('Initializing LIFF...')
        await liff.init({ liffId })
        isInitialized = true
        console.log('LIFF initialization succeeded')
    } else {
        console.log('LIFF already initialized, skipping initialization')
    }

    // provide ให้เรียกใช้ได้ผ่าน useNuxtApp().$liff
    nuxtApp.provide('liff', liff)

})
