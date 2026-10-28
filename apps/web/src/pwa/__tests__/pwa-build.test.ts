import { readFileSync, readdirSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path)
    return [path]
  })
}

describe('production PWA artifacts', () => {
  it('contains one manifest and only approved static precache entries', () => {
    const html = readFileSync('dist/index.html', 'utf8')
    const manifest = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'))
    const sw = readFileSync('dist/sw.js', 'utf8')
    const buildTime = statSync('dist/sw.js').mtimeMs
    for (const source of ['vite.config.ts', 'index.html', '../../pnpm-lock.yaml', ...sourceFiles('src'), ...sourceFiles('public'), ...sourceFiles('../../packages')]) {
      expect(statSync(source).mtimeMs, `${source} is newer than dist/sw.js; rebuild before testing`).toBeLessThanOrEqual(buildTime)
    }
    expect(html.match(/rel="manifest"/g)).toHaveLength(1)
    expect(manifest).toMatchObject({ id: '/', start_url: '/', scope: '/', display: 'standalone' })
    expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(['192x192', '512x512'])
    const urls = [...sw.matchAll(/\{url:"([^"]+)",revision:/g)].map(match => match[1])
    expect(urls).toContain('index.html')
    expect(urls).toContain('manifest.webmanifest')
    for (const file of readdirSync('dist/assets').filter(file => /\.(js|css)$/.test(file))) {
      expect(urls).toContain(`assets/${file}`)
      expect(statSync(`dist/assets/${file}`).size).toBeLessThanOrEqual(2.5 * 1024 * 1024)
    }
    for (const url of urls) {
      expect(url).toMatch(/^(?:index\.html|manifest\.webmanifest|assets\/[^/]+\.(?:js|css)|(?:android-chrome-\d+x\d+|apple-touch-icon|favicon-\d+x\d+|logo-icon|logo)\.png|favicon\.ico)$/)
    }
    expect(sw).not.toContain('clientsClaim()')
    expect(html).not.toMatch(/registerSW|serviceWorker\.register/)
  })

  it('preserves app rewrites and revalidates entry artifacts', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8'))
    const rewrite = new RegExp(`^${config.rewrites[0].source}$`)
    for (const path of ['/dashboard', '/tasks/inbox', '/settings', '/admin/users']) expect(rewrite.test(path), path).toBe(true)
    for (const path of ['/_vercel/insights', '/auth/v1', '/rest/v1', '/functions/v1', '/storage/v1', '/realtime/v1', '/assets/missing.js', '/sw.js']) expect(rewrite.test(path), path).toBe(false)
    for (const path of ['/', '/index.html', '/sw.js', '/manifest.webmanifest']) {
      const entry = config.headers.find((item: { source: string }) => item.source === path)
      expect(entry?.headers).toContainEqual({ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' })
    }
  })
})
