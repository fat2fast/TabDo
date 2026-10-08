export interface ResolvedSupabaseKeys {
  supabaseUrl: string
  publishableKey: string
  secretKey: string
}

export type ResolveKeysResult =
  | { ok: true; keys: ResolvedSupabaseKeys }
  | { ok: false; error: 'Server configuration error' }

export interface EnvGetter {
  get: (key: string) => string | undefined
}

/**
 * Resolves Supabase credentials using the new API key format with legacy fallbacks.
 *
 * Priority:
 * 1. Publishable: JSON dictionary SUPABASE_PUBLISHABLE_KEYS ('default' key) -> SUPABASE_PUBLISHABLE_KEY -> SUPABASE_ANON_KEY
 * 2. Secret: JSON dictionary SUPABASE_SECRET_KEYS ('default' key) -> SUPABASE_SECRET_KEY -> SUPABASE_SERVICE_ROLE_KEY
 *
 * Fails closed with generic 'Server configuration error' without leaking credential values.
 */
export function resolveSupabaseKeys(env?: EnvGetter): ResolveKeysResult {
  const envGetter = env ?? Deno.env

  const supabaseUrl = envGetter.get('SUPABASE_URL')?.trim()
  if (!supabaseUrl) {
    return { ok: false, error: 'Server configuration error' }
  }

  // 1. Resolve Publishable Key
  let publishableKey: string | null = null
  const publishableDictRaw = envGetter.get('SUPABASE_PUBLISHABLE_KEYS')
  if (publishableDictRaw !== undefined && publishableDictRaw !== '') {
    try {
      const parsed = JSON.parse(publishableDictRaw)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        if (typeof parsed.default === 'string' && parsed.default.trim().length > 0) {
          publishableKey = parsed.default.trim()
        } else {
          // fallback to first valid string value if no 'default' property
          const values = Object.values(parsed)
          const firstVal = values.find((v) => typeof v === 'string' && v.trim().length > 0)
          if (firstVal && typeof firstVal === 'string') {
            publishableKey = firstVal.trim()
          }
        }
      }
      if (!publishableKey) {
        return { ok: false, error: 'Server configuration error' }
      }
    } catch {
      return { ok: false, error: 'Server configuration error' }
    }
  } else {
    const singlePubKey = envGetter.get('SUPABASE_PUBLISHABLE_KEY')?.trim()
    const legacyAnonKey = envGetter.get('SUPABASE_ANON_KEY')?.trim()
    publishableKey = singlePubKey || legacyAnonKey || null
  }

  if (!publishableKey) {
    return { ok: false, error: 'Server configuration error' }
  }

  // 2. Resolve Secret Key
  let secretKey: string | null = null
  const secretDictRaw = envGetter.get('SUPABASE_SECRET_KEYS')
  if (secretDictRaw !== undefined && secretDictRaw !== '') {
    try {
      const parsed = JSON.parse(secretDictRaw)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        if (typeof parsed.default === 'string' && parsed.default.trim().length > 0) {
          secretKey = parsed.default.trim()
        } else {
          const values = Object.values(parsed)
          const firstVal = values.find((v) => typeof v === 'string' && v.trim().length > 0)
          if (firstVal && typeof firstVal === 'string') {
            secretKey = firstVal.trim()
          }
        }
      }
      if (!secretKey) {
        return { ok: false, error: 'Server configuration error' }
      }
    } catch {
      return { ok: false, error: 'Server configuration error' }
    }
  } else {
    const singleSecretKey = envGetter.get('SUPABASE_SECRET_KEY')?.trim()
    const legacyServiceKey = envGetter.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
    secretKey = singleSecretKey || legacyServiceKey || null
  }

  if (!secretKey) {
    return { ok: false, error: 'Server configuration error' }
  }

  return {
    ok: true,
    keys: {
      supabaseUrl,
      publishableKey,
      secretKey,
    },
  }
}
