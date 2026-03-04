// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@nuxt/eslint', '@nuxtjs/google-fonts', '@nuxt/image'],
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
      allowedHosts: ['.ngrok-free.app'],
      hmr: {
        protocol: 'wss',
        clientPort: 443
      }
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
        { rel: 'icon', type: 'image/png', href: '/logo-saijai-phareab.png' },
      ],
    },
  },
})