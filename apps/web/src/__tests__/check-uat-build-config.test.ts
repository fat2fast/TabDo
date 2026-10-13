import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkUatBuildConfig, parseDotenv } from '../../../../scripts/check-uat-build-config'

describe('checkUatBuildConfig', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uat-config-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('parses dotenv correctly with quotes and comments', () => {
    const raw = `
# Comment
KEY_ONE="value1"
KEY_TWO='value2'
KEY_THREE=value3
EMPTY_KEY=
`
    const parsed = parseDotenv(raw)
    expect(parsed.KEY_ONE).toBe('value1')
    expect(parsed.KEY_TWO).toBe('value2')
    expect(parsed.KEY_THREE).toBe('value3')
    expect(parsed.EMPTY_KEY).toBe('')
  })

  it('passes on valid configuration with matching project id and uat target', () => {
    const projectJsonPath = path.join(tmpDir, 'project.json')
    const envLocalPath = path.join(tmpDir, '.env.production.local')

    fs.writeFileSync(projectJsonPath, JSON.stringify({ projectId: 'prj_tabdo_uat_123' }))
    fs.writeFileSync(
      envLocalPath,
      `
VITE_SUPABASE_URL="https://abcdefghijkl.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_pub_live_token_12345678"
NODE_ENV="production"
`
    )

    const report = checkUatBuildConfig({
      projectJsonPath,
      envLocalPath,
      expectedProjectId: 'prj_tabdo_uat_123',
      expectedProjectRef: 'abcdefghijkl',
    })

    expect(report.ok).toBe(true)
    expect(report.errors).toHaveLength(0)
    expect(report.info.length).toBeGreaterThan(0)
  })

  it('fails when project ID does not match expected VERCEL_PROJECT_ID', () => {
    const projectJsonPath = path.join(tmpDir, 'project.json')
    const envLocalPath = path.join(tmpDir, '.env.production.local')

    fs.writeFileSync(projectJsonPath, JSON.stringify({ projectId: 'prj_wrong_target' }))
    fs.writeFileSync(
      envLocalPath,
      `
VITE_SUPABASE_URL="https://abcdefghijkl.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_pub_live_token_12345678"
`
    )

    const report = checkUatBuildConfig({
      projectJsonPath,
      envLocalPath,
      expectedProjectId: 'prj_expected_target',
      expectedProjectRef: 'abcdefghijkl',
    })

    expect(report.ok).toBe(false)
    expect(report.errors.some((e) => e.includes('Vercel projectId mismatch'))).toBe(true)
  })

  it('fails when Supabase URL targets localhost, invalid domain, or is not HTTPS', () => {
    const projectJsonPath = path.join(tmpDir, 'project.json')
    const envLocalPath = path.join(tmpDir, '.env.production.local')

    fs.writeFileSync(projectJsonPath, JSON.stringify({ projectId: 'prj_123' }))
    fs.writeFileSync(
      envLocalPath,
      `
VITE_SUPABASE_URL="http://127.0.0.1:54321"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_pub_live_token_12345678"
`
    )

    const report = checkUatBuildConfig({
      projectJsonPath,
      envLocalPath,
      expectedProjectId: 'prj_123',
      expectedProjectRef: 'abcdefghijkl',
    })

    expect(report.ok).toBe(false)
    expect(report.errors.some((e) => e.includes('HTTPS'))).toBe(true)
    expect(report.errors.some((e) => e.includes('local database'))).toBe(true)
  })

  it('fails when Supabase key is placeholder value', () => {
    const projectJsonPath = path.join(tmpDir, 'project.json')
    const envLocalPath = path.join(tmpDir, '.env.production.local')

    fs.writeFileSync(projectJsonPath, JSON.stringify({ projectId: 'prj_123' }))
    fs.writeFileSync(
      envLocalPath,
      `
VITE_SUPABASE_URL="https://abcdefghijkl.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="ci-placeholder-public-anon-key"
`
    )

    const report = checkUatBuildConfig({
      projectJsonPath,
      envLocalPath,
      expectedProjectId: 'prj_123',
      expectedProjectRef: 'abcdefghijkl',
    })

    expect(report.ok).toBe(false)
    expect(report.errors.some((e) => e.includes('placeholder'))).toBe(true)
  })

  it('fails when NODE_ENV is set to development', () => {
    const projectJsonPath = path.join(tmpDir, 'project.json')
    const envLocalPath = path.join(tmpDir, '.env.production.local')

    fs.writeFileSync(projectJsonPath, JSON.stringify({ projectId: 'prj_123' }))
    fs.writeFileSync(
      envLocalPath,
      `
VITE_SUPABASE_URL="https://abcdefghijkl.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_pub_live_token_12345678"
NODE_ENV="development"
`
    )

    const report = checkUatBuildConfig({
      projectJsonPath,
      envLocalPath,
      expectedProjectId: 'prj_123',
      expectedProjectRef: 'abcdefghijkl',
    })

    expect(report.ok).toBe(false)
    expect(report.errors.some((e) => e.includes("expected 'production'"))).toBe(true)
  })
})
