import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: '#e8f4fd' },
          100: { value: '#b9dff9' },
          200: { value: '#8acaf5' },
          300: { value: '#5bb5f1' },
          400: { value: '#2ca0ed' },
          500: { value: '#0d7dd4' },
          600: { value: '#0a62a6' },
          700: { value: '#074778' },
          800: { value: '#042b4a' },
          900: { value: '#01101c' },
        },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
