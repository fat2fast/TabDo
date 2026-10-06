import { createClient, SupabaseClientOptions } from '@supabase/supabase-js'

export interface CreateTabDoClientParams {
  url: string
  anonKey: string
  options?: SupabaseClientOptions<'public'>
}

export function createTabDoClient({ url, anonKey, options }: CreateTabDoClientParams) {
  return createClient(url, anonKey, options)
}

export * from './reminders.js'
