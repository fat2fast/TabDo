import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateLocalSupabaseStatus } from '../../../../scripts/reset-local-db'
import { checkSeedSafety } from '../../../../scripts/check-seed-safety'

describe('Seed Safety & Local Reset Preflight', () => {
  it('validates loopback host and correct ports in status output', () => {
    const validJson = JSON.stringify({
      API_URL: 'http://127.0.0.1:54321',
      DB_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
      ANON_KEY: 'test-key',
    })

    const res = validateLocalSupabaseStatus(validJson)
    expect(res.apiUrl).toBe('http://127.0.0.1:54321')
    expect(res.dbUrl).toBe('postgresql://postgres:postgres@127.0.0.1:54322/postgres')
  })

  it('rejects remote or non-loopback API_URL', () => {
    const remoteJson = JSON.stringify({
      API_URL: 'https://project.supabase.co:54321',
      DB_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    })
    expect(() => validateLocalSupabaseStatus(remoteJson)).toThrow(/Refusing to reset non-loopback API host/)
  })

  it('rejects unexpected ports', () => {
    const wrongPortJson = JSON.stringify({
      API_URL: 'http://127.0.0.1:8000',
      DB_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    })
    expect(() => validateLocalSupabaseStatus(wrongPortJson)).toThrow(/Unexpected local API port/)
  })

  it('verifies repo seed isolation safety rules', () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
    const report = checkSeedSafety(repoRoot)
    expect(report.ok).toBe(true)
    expect(report.errors).toHaveLength(0)
  })
})
