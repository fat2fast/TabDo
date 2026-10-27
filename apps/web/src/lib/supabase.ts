import { createTabDoClient } from '@tabdo/supabase'

function resolveSupabaseUrl(): string {
  const envUrl = import.meta.env.VITE_SUPABASE_URL
  if (typeof window !== 'undefined') {
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '[::1]'
    if (!isLocalhost && (envUrl?.includes('127.0.0.1') || envUrl?.includes('localhost'))) {
      return window.location.origin
    }
  }
  return envUrl
}

const url = resolveSupabaseUrl()
const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !publishableKey) {
  throw new Error(
    `Missing Supabase environment variables: ${!url ? 'VITE_SUPABASE_URL ' : ''}${!publishableKey ? 'VITE_SUPABASE_PUBLISHABLE_KEY Or VITE_SUPABASE_ANON_KEY' : ''}. Check apps/web/.env`
  )
}

export const supabase = createTabDoClient({ url, publishableKey })
