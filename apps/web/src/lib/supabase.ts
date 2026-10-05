import { createTabDoClient } from '@tabdo/supabase'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    `Missing Supabase environment variables: ${!url ? 'VITE_SUPABASE_URL ' : ''}${!anonKey ? 'VITE_SUPABASE_ANON_KEY' : ''}. Check apps/web/.env`
  )
}

export const supabase = createTabDoClient({ url, anonKey })
