import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { 'virtual:pwa-register': fileURLToPath(new URL('./src/test/pwa-register-mock.ts', import.meta.url)) } },
  define: {
    __APP_VERSION__: JSON.stringify('9e660dc'),
    __DEPLOY_DATE__: JSON.stringify('10/10/2026'),
  },
  server: {
    fs: {
      allow: ['../..'],
    },
  },
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/pwa-build.test.ts'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
