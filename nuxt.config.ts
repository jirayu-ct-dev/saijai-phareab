// https://nuxt.com/docs/api/configuration/nuxt-config

// CSP tuned for LIFF: the SDK is bundled from npm (no CDN script), the app
// renders inside LINE's in-app iframe (frame-ancestors), LINE profile
// pictures come from line-scdn, and shop/product images from Cloudinary.
// Dev needs eval + localhost ws/http for Vite HMR.
const isDev = process.env.NODE_ENV === 'development'
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  'img-src \'self\' data: blob: https://res.cloudinary.com https://profile.line-scdn.net',
  "font-src 'self' data:",
  `connect-src 'self' https://api.line.me${isDev ? ' ws://localhost:* http://localhost:*' : ''}`,
  // LIFF runs embedded in LINE (liff.line.me / www.line-web.me ancestors).
  'frame-ancestors https://*.line.me https://*.line-web.me',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

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
    routeRules: {
      '/**': {
        headers: {
          'Content-Security-Policy': contentSecurityPolicy,
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
          'Strict-Transport-Security': 'max-age=15552000',
        },
      },
    },
    // Cron times are UTC. 02:00 UTC = 09:00 Asia/Bangkok.
    scheduledTasks: {
      '0 2 * * *': ['notify:expiring-packages'],
    },
  },
  runtimeConfig: {
    public: {
      liffId: process.env.NUXT_PUBLIC_LIFF_ID,
      lineBizChatUrl: process.env.LINE_BIZ_CHAT_URL,
      // PRN-06 rollback flag: legacy browser-direct (WebUSB/BLE) printing stays
      // available until the physical regression matrix (HW-02) passes. Set to
      // "false" to hide the legacy direct-print entry points.
      printLegacyDirect: process.env.NUXT_PUBLIC_PRINT_LEGACY_DIRECT ?? 'true'
    }
  }
})
