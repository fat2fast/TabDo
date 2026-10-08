import { createTabDoClient } from '@tabdo/supabase'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !publishableKey) {
  throw new Error(
    `Missing Supabase environment variables: ${!url ? 'VITE_SUPABASE_URL ' : ''}${!publishableKey ? 'VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY' : ''}. Check apps/web/.env`
  )
}

export const supabase = createTabDoClient({ url, publishableKey })
