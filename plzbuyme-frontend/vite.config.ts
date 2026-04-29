/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // Tests that drive several async user-event clicks plus waitFor polls
    // (e.g. AuctionListPage status-tab interactions) can exceed the default
    // 5s timeout on slower machines / CI under parallel load. Give them
    // enough headroom to run reliably.
    testTimeout: 15000,
  },
})
