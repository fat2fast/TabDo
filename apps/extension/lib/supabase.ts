import { createTabDoClient } from '@tabdo/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AUTH_STORAGE_KEY, storageGet, storageSet, storageRemove } from './storage.js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable for TabDo extension.')
}

if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable for TabDo extension.')
}

export const chromeStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    return storageGet<string>(key)
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await storageSet<string>(key, value)
  },
  removeItem: async (key: string): Promise<void> => {
    await storageRemove(key)
  },
}

export const supabase: SupabaseClient = createTabDoClient({
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  options: {
    auth: {
      storageKey: AUTH_STORAGE_KEY,
      storage: chromeStorageAdapter,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
})
