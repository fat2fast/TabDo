import { describe, expect, it } from 'vitest'
import { pwaOptions } from '../../../vite.config'

describe('PWA configuration', () => {
  it('uses explicit static precaching and consent-based registration', () => {
    expect(pwaOptions).toMatchObject({ strategies: 'generateSW', registerType: 'prompt', injectRegister: false, devOptions: { enabled: false } })
    expect(pwaOptions.manifest).toMatchObject({ id: '/', start_url: '/', scope: '/', display: 'standalone' })
    expect(pwaOptions.workbox).toMatchObject({ runtimeCaching: [], globPatterns: ['index.html', 'assets/*.{js,css}'], maximumFileSizeToCacheInBytes: 2.5 * 1024 * 1024 })
  })

  it('serves app navigation but excludes sensitive callback URLs', () => {
    const { navigateFallbackAllowlist: allow = [], navigateFallbackDenylist: deny = [] } = pwaOptions.workbox!
    const matches = (url: string) => allow.some(pattern => pattern.test(url)) && !deny.some(pattern => pattern.test(url))
    for (const url of ['/', '/login', '/admin/login', '/change-password', '/dashboard', '/tasks/inbox', '/calendar', '/summary/monthly', '/settings', '/admin/users']) expect(matches(url), url).toBe(true)
    for (const url of ['/auth/v1', '/rest/v1', '/functions/v1', '/storage/v1', '/realtime/v1', '/_vercel/insights', '/?code=abc', '/login?error=denied', '/dashboard?access_token=secret']) expect(matches(url), url).toBe(false)
  })
})
