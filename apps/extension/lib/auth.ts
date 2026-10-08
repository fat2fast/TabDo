import type { SupabaseClient } from '@supabase/supabase-js'
import { clearReminderAlarms } from './alarm-reconciliation.js'
import { supabase } from './supabase.js'
import {
  clearAllAuthAndUserStorage,
  getActiveUserId,
  setActiveUserId,
} from './storage.js'
import type { ExtensionAuthStatus, ExtensionAuthUser } from './types.js'

export const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh'

export async function fetchUserProfile(
  client: SupabaseClient,
  userId: string,
  email: string
): Promise<ExtensionAuthUser> {
  const { data, error } = await client
    .from('profiles')
    .select('id, display_name, timezone')
    .eq('id', userId)
    .single()

  if (error || !data) {
    return {
      id: userId,
      email,
      displayName: null,
      timezone: DEFAULT_TIMEZONE,
    }
  }

  const row = data as { id: string; display_name: string | null; timezone: string | null }
  return {
    id: userId,
    email,
    displayName: row.display_name || null,
    timezone: row.timezone || DEFAULT_TIMEZONE,
  }
}

export async function handleInvalidSession(
  client: SupabaseClient,
  userId?: string
): Promise<void> {
  await clearReminderAlarms()
  try {
    await client.auth.signOut()
  } catch {
    // Ignore remote sign-out failures during invalid-session recovery
  }
  await clearAllAuthAndUserStorage(userId)
}

export async function restoreSession(
  client: SupabaseClient = supabase
): Promise<{ status: ExtensionAuthStatus; user: ExtensionAuthUser | null }> {
  try {
    const {
      data: { session },
      error: sessionError,
    } = await client.auth.getSession()

    if (sessionError || !session || !session.user) {
      await clearReminderAlarms()
      const activeId = await getActiveUserId()
      if (activeId) {
        await clearAllAuthAndUserStorage(activeId)
      }
      return { status: 'unauthenticated', user: null }
    }

    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser()

    if (userError || !user) {
      await handleInvalidSession(client, session.user.id)
      return { status: 'unauthenticated', user: null }
    }

    await setActiveUserId(user.id)
    const profile = await fetchUserProfile(client, user.id, user.email || '')
    return { status: 'authenticated', user: profile }
  } catch {
    await clearReminderAlarms()
    const activeId = await getActiveUserId()
    if (activeId) {
      await clearAllAuthAndUserStorage(activeId)
    }
    return { status: 'unauthenticated', user: null }
  }
}

export async function signIn(
  client: SupabaseClient = supabase,
  credentials: { email: string; password: string }
): Promise<ExtensionAuthUser> {
  const { data, error } = await client.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  })

  if (error || !data.user) {
    throw new Error(error?.message || 'Failed to sign in')
  }

  await setActiveUserId(data.user.id)
  const profile = await fetchUserProfile(client, data.user.id, data.user.email || credentials.email)
  return profile
}

export async function signOut(client: SupabaseClient = supabase): Promise<void> {
  await clearReminderAlarms()
  const activeUserId = await getActiveUserId()
  try {
    await client.auth.signOut()
  } catch {
    // Ignore remote sign-out failures
  }
  await clearAllAuthAndUserStorage(activeUserId || undefined)
}
