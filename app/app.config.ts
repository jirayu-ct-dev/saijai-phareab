export default defineAppConfig({
  ui: {
    colors: {
      primary: 'sky',
      secondary: 'blue',
      success: 'emerald',
      info: 'cyan',
      warning: 'amber',
      error: 'rose',
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
        base: 'cursor-pointer rounded-md!'
      }
    },
    badge: {
      slots: {
        base: 'rounded-md!'
      }
    },
    input: {
      slots: {
        base: 'rounded-md!'
      }
    },
    inputNumber: {
      slots: {
        base: 'rounded-md!'
      }
    },
    select: {
      slots: {
        base: 'rounded-md!',
        content: 'rounded-md!',
        item: 'before:rounded-md!'
      }
    },
    selectMenu: {
      slots: {
        base: 'rounded-md!',
        content: 'rounded-md!',
        item: 'before:rounded-md!'
      }
    }
  }
})
