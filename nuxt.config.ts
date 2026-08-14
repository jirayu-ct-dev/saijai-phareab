// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@nuxt/eslint', '@nuxtjs/google-fonts', '@nuxt/image', '@vueuse/nuxt'],
  css: ['@/assets/css/main.css'],
  googleFonts: {
    families: {
      'Prompt': [400, 500, 600, 700],
    },
  },
  image: {
    provider: 'cloudinary',
    cloudinary: {
      baseURL: `https://res.cloudinary.com/${process.env.CLOUDINARY_NAME}/image/upload`,
    },
  },
  vite: {
    server: {
      allowedHosts: [`${process.env.NUXT_PUBLIC_HOSTNAME}`, 'localhost', '127.0.0.1'],
    },
  },
  app: {
    head: {
      title: 'Saijai Phareab',
      meta: [
        { name: 'description', content: 'Saijai Phareab' },
        { name: 'keywords', content: 'Saijai Phareab' },
        { name: 'author', content: 'Saijai Phareab' },
      ],
      htmlAttrs: {
        lang: 'th',
      },
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.ico' },
      ],
    },
  },
  nitro: {
    experimental: {
      tasks: true,
    },
    // Cron times are UTC. 02:00 UTC = 09:00 Asia/Bangkok.
    scheduledTasks: {
      '0 2 * * *': ['notify:expiring-packages'],
      '*/5 * * * *': ['notify:pickup-confirmations'],
    },
  },
  runtimeConfig: {
    public: {
      liffId: process.env.NUXT_PUBLIC_LIFF_ID,
      lineBizChatUrl: process.env.LINE_BIZ_CHAT_URL
    }
  }
})
