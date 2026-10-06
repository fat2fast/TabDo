import { deriveCacheNamespace } from '@tabdo/utils'
import type {
  ExtensionNotificationContext,
  ExtensionUserCache,
} from './types.js'

export const AUTH_STORAGE_KEY = 'tabdo:auth:session'
export const ACTIVE_USER_ID_KEY = 'tabdo:auth:active_user_id'
export const NOTIFICATIONS_STORAGE_KEY = 'tabdo:notifications'

export async function storageGet<T>(key: string): Promise<T | null> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return null
  }
  const result = await chrome.storage.local.get(key)
  const val = result[key]
  return (val !== undefined ? val : null) as T | null
}

export async function storageSet<T>(key: string, value: T): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return
  }
  await chrome.storage.local.set({ [key]: value })
}

export async function storageRemove(keys: string | string[]): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return
  }
  await chrome.storage.local.remove(keys)
}

export function getUserCacheKey(userId: string): string {
  return deriveCacheNamespace(userId)
}

export async function getUserCache(userId: string): Promise<ExtensionUserCache | null> {
  if (!userId) return null
  const key = getUserCacheKey(userId)
  return storageGet<ExtensionUserCache>(key)
}

export async function setUserCache(userId: string, cache: ExtensionUserCache): Promise<void> {
  if (!userId) return
  const key = getUserCacheKey(userId)
  await storageSet(key, cache)
}

export async function removeUserCache(userId: string): Promise<void> {
  if (!userId) return
  const key = getUserCacheKey(userId)
  await storageRemove(key)
}

export async function getActiveUserId(): Promise<string | null> {
  return storageGet<string>(ACTIVE_USER_ID_KEY)
}

export async function setActiveUserId(userId: string | null): Promise<void> {
  if (userId) {
    await storageSet(ACTIVE_USER_ID_KEY, userId)
  } else {
    await storageRemove(ACTIVE_USER_ID_KEY)
  }
}

export async function getAllNotificationContexts(): Promise<Record<string, ExtensionNotificationContext>> {
  const contexts = await storageGet<Record<string, ExtensionNotificationContext>>(NOTIFICATIONS_STORAGE_KEY)
  return contexts || {}
}

export async function getNotificationContext(
  notificationId: string
): Promise<ExtensionNotificationContext | null> {
  const map = await getAllNotificationContexts()
  return map[notificationId] || null
}

export async function setNotificationContext(
  notificationId: string,
  context: ExtensionNotificationContext
): Promise<void> {
  const map = await getAllNotificationContexts()
  map[notificationId] = context
  await storageSet(NOTIFICATIONS_STORAGE_KEY, map)
}

export async function removeNotificationContext(notificationId: string): Promise<void> {
  const map = await getAllNotificationContexts()
  if (map[notificationId]) {
    delete map[notificationId]
    await storageSet(NOTIFICATIONS_STORAGE_KEY, map)
  }
}

export async function clearAllNotificationContexts(): Promise<void> {
  await storageRemove(NOTIFICATIONS_STORAGE_KEY)
}

/**
 * Cleans up user-scoped cache and notification context.
 * Used during sign-out or when an invalid session is detected.
 */
export async function clearUserStorage(userId: string): Promise<void> {
  if (userId) {
    await removeUserCache(userId)
  }
  await clearAllNotificationContexts()
}

/**
 * Complete teardown of auth session, active user, user-scoped cache, and notifications.
 */
export async function clearAllAuthAndUserStorage(userId?: string): Promise<void> {
  const activeUserId = userId || (await getActiveUserId())
  if (activeUserId) {
    await removeUserCache(activeUserId)
  }
  await storageRemove([AUTH_STORAGE_KEY, ACTIVE_USER_ID_KEY])
  await clearAllNotificationContexts()
}
