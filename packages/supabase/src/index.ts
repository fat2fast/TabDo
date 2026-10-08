import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js'

export interface CreateTabDoClientParams {
  url: string
  anonKey?: string
  publishableKey?: string
  options?: SupabaseClientOptions<'public'>
}

export function createTabDoClient({ url, anonKey, publishableKey, options }: CreateTabDoClientParams) {
  const key = publishableKey || anonKey
  if (!key) {
    throw new Error('createTabDoClient requires publishableKey or anonKey')
  }
  return createClient(url, key, options)
}

export * from './reminders.js'
export * from './tasks.js'
