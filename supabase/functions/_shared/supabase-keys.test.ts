import { assertEquals } from 'jsr:@std/assert@1'
import { resolveSupabaseKeys, type EnvGetter } from './supabase-keys.ts'

function mockEnv(map: Record<string, string>): EnvGetter {
  return {
    get: (key: string) => map[key],
  }
}

Deno.test('resolveSupabaseKeys - parses JSON dictionaries with default key', () => {
  const env = mockEnv({
    SUPABASE_URL: 'http://127.0.0.1:54321',
    SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: 'pk_default_123', alt: 'pk_alt_456' }),
    SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sk_default_789', alt: 'sk_alt_000' }),
  })

  const res = resolveSupabaseKeys(env)
  assertEquals(res.ok, true)
  if (res.ok) {
    assertEquals(res.keys.supabaseUrl, 'http://127.0.0.1:54321')
    assertEquals(res.keys.publishableKey, 'pk_default_123')
    assertEquals(res.keys.secretKey, 'sk_default_789')
  }
})

Deno.test('resolveSupabaseKeys - parses single new environment variables', () => {
  const env = mockEnv({
    SUPABASE_URL: 'http://127.0.0.1:54321',
    SUPABASE_PUBLISHABLE_KEY: 'pk_single_123',
    SUPABASE_SECRET_KEY: 'sk_single_456',
  })

  const res = resolveSupabaseKeys(env)
  assertEquals(res.ok, true)
  if (res.ok) {
    assertEquals(res.keys.publishableKey, 'pk_single_123')
    assertEquals(res.keys.secretKey, 'sk_single_456')
  }
})

Deno.test('resolveSupabaseKeys - falls back to legacy anon and service_role keys', () => {
  const env = mockEnv({
    SUPABASE_URL: 'http://127.0.0.1:54321',
    SUPABASE_ANON_KEY: 'anon_legacy_jwt',
    SUPABASE_SERVICE_ROLE_KEY: 'service_role_legacy_jwt',
  })

  const res = resolveSupabaseKeys(env)
  assertEquals(res.ok, true)
  if (res.ok) {
    assertEquals(res.keys.publishableKey, 'anon_legacy_jwt')
    assertEquals(res.keys.secretKey, 'service_role_legacy_jwt')
  }
})

Deno.test('resolveSupabaseKeys - fails closed when SUPABASE_PUBLISHABLE_KEYS is malformed', () => {
  const env = mockEnv({
    SUPABASE_URL: 'http://127.0.0.1:54321',
    SUPABASE_PUBLISHABLE_KEYS: 'not-valid-json{',
    SUPABASE_SECRET_KEY: 'sk_valid',
  })

  const res = resolveSupabaseKeys(env)
  assertEquals(res.ok, false)
  if (!res.ok) {
    assertEquals(res.error, 'Server configuration error')
  }
})

Deno.test('resolveSupabaseKeys - fails closed when SUPABASE_SECRET_KEYS is malformed', () => {
  const env = mockEnv({
    SUPABASE_URL: 'http://127.0.0.1:54321',
    SUPABASE_PUBLISHABLE_KEY: 'pk_valid',
    SUPABASE_SECRET_KEYS: 'malformed_json_dict',
  })

  const res = resolveSupabaseKeys(env)
  assertEquals(res.ok, false)
  if (!res.ok) {
    assertEquals(res.error, 'Server configuration error')
  }
})

Deno.test('resolveSupabaseKeys - fails closed when any key is missing', () => {
  const envMissingUrl = mockEnv({
    SUPABASE_PUBLISHABLE_KEY: 'pk_valid',
    SUPABASE_SECRET_KEY: 'sk_valid',
  })
  assertEquals(resolveSupabaseKeys(envMissingUrl).ok, false)

  const envMissingPub = mockEnv({
    SUPABASE_URL: 'http://127.0.0.1:54321',
    SUPABASE_SECRET_KEY: 'sk_valid',
  })
  assertEquals(resolveSupabaseKeys(envMissingPub).ok, false)

  const envMissingSecret = mockEnv({
    SUPABASE_URL: 'http://127.0.0.1:54321',
    SUPABASE_PUBLISHABLE_KEY: 'pk_valid',
  })
  assertEquals(resolveSupabaseKeys(envMissingSecret).ok, false)
})
