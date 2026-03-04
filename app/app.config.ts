export default defineAppConfig({
  ui: {
    colors: {
      primary: 'brand',
      secondary: 'purple',
      success: 'green',
      info: 'blue',
      warning: 'yellow',
      error: 'red',
      neutral: 'slate'
    },
    icons: {
      light: 'i-ph-sun',
      dark: 'i-ph-moon',
      loading: 'i-lucide-loader-circle',
      search: 'i-lucide-search',
      menu: 'i-lucide-menu'
    },
    toaster: {
      defaultVariants: {
        position: 'top-center',
      }
    },
    button: {
      slots: {
        base: 'cursor-pointer'
      }
    }
  }
})
