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
): Promise<ExtensionAuthUser | null> {
  const tableRef = client.from('profiles')
  if (!tableRef || typeof tableRef.select !== 'function') {
    return {
      id: userId,
      email,
      displayName: null,
      timezone: DEFAULT_TIMEZONE,
      isActive: true,
      mustChangePassword: false,
      locale: 'vi',
    }
  }

  const { data, error } = await tableRef
    .select('id, display_name, timezone, is_active, must_change_password, locale')
    .eq('id', userId)
    .single()

  if (error || !data) {
    return null
  }

  const row = data as {
    id: string
    display_name: string | null
    timezone: string | null
    is_active?: boolean
    must_change_password?: boolean
    locale?: string | null
  }

  return {
    id: userId,
    email,
    displayName: row.display_name || null,
    timezone: row.timezone || DEFAULT_TIMEZONE,
    isActive: row.is_active ?? true,
    mustChangePassword: row.must_change_password ?? false,
    locale: (row.locale as 'vi' | 'en') || 'vi',
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

    const profile = await fetchUserProfile(client, user.id, user.email || '')
    if (!profile) {
      await handleInvalidSession(client, user.id)
      return { status: 'unauthenticated', user: null }
    }

    if (profile.isActive === false) {
      await handleInvalidSession(client, user.id)
      return { status: 'inactive', user: profile }
    }

    if (profile.mustChangePassword === true) {
      await clearReminderAlarms()
      await setActiveUserId(user.id)
      return { status: 'password_change_required', user: profile }
    }

    await setActiveUserId(user.id)
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

  const profile = await fetchUserProfile(client, data.user.id, data.user.email || credentials.email)
  if (!profile) {
    await handleInvalidSession(client, data.user.id)
    throw new Error('Failed to load profile')
  }

  if (profile.isActive === false) {
    await handleInvalidSession(client, data.user.id)
    throw new Error('Account is inactive')
  }

  if (profile.mustChangePassword === true) {
    await clearReminderAlarms()
  }

  await setActiveUserId(data.user.id)
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
