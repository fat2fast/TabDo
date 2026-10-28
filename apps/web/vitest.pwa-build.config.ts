import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node', include: ['src/pwa/__tests__/pwa-build.test.ts'] },
})
