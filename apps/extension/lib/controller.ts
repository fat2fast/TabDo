import type { SupabaseClient } from '@supabase/supabase-js'
import {
  completeTask,
  getExtensionTodayTasks,
  quickAddTask,
} from '@tabdo/supabase'
import {
  markReminderTriggered,
  snoozeReminder,
} from '@tabdo/supabase'
import { restoreSession, signIn, signOut } from './auth.js'
import {
  getUserCache,
  setUserCache,
  removeUserCache,
  clearAllNotificationContexts,
} from './storage.js'
import { supabase } from './supabase.js'
import type {
  ExtensionMessage,
  ExtensionResult,
  ExtensionState,
  ExtensionUserCache,
} from './types.js'

export class AsyncMutex {
  private queue: Promise<unknown> = Promise.resolve()

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    let resolveResult!: (value: T) => void
    let rejectResult!: (reason?: unknown) => void
    const resultPromise = new Promise<T>((res, rej) => {
      resolveResult = res
      rejectResult = rej
    })

    this.queue = this.queue.then(async () => {
      try {
        const val = await fn()
        resolveResult(val)
      } catch (err) {
        rejectResult(err)
      }
    })

    return resultPromise
  }
}

import { syncExtensionState } from './sync.js'

export const controllerMutex = new AsyncMutex()

export type SyncFn = (client: SupabaseClient) => Promise<ExtensionState>

let activeSyncHandler: SyncFn | null = syncExtensionState

export function setSyncHandler(handler: SyncFn | null): void {
  activeSyncHandler = handler
}

/**
 * Fallback sync when sync module handler is not registered.
 */
async function defaultSync(
  client: SupabaseClient
): Promise<ExtensionState> {
  const auth = await restoreSession(client)
  if (auth.status !== 'authenticated' || !auth.user) {
    return {
      status: 'unauthenticated',
      user: null,
      todayTasks: [],
      syncMetadata: {
        lastSuccessfulSyncAt: null,
        lastSyncError: null,
        isStale: false,
      },
    }
  }

  try {
    const todayTasks = await getExtensionTodayTasks(client, auth.user.timezone)
    const existingCache = await getUserCache(auth.user.id)
    const updatedCache: ExtensionUserCache = {
      userId: auth.user.id,
      todayTasks,
      upcomingReminders: existingCache?.upcomingReminders || [],
      metadata: {
        lastSuccessfulSyncAt: new Date().toISOString(),
        lastSyncError: null,
        isStale: false,
      },
    }
    await setUserCache(auth.user.id, updatedCache)
    return {
      status: 'authenticated',
      user: auth.user,
      todayTasks,
      syncMetadata: updatedCache.metadata,
    }
  } catch (err: unknown) {
    const existingCache = await getUserCache(auth.user.id)
    const errorMessage = err instanceof Error ? err.message : String(err)
    return {
      status: 'authenticated',
      user: auth.user,
      todayTasks: existingCache?.todayTasks || [],
      syncMetadata: {
        lastSuccessfulSyncAt: existingCache?.metadata.lastSuccessfulSyncAt || null,
        lastSyncError: errorMessage,
        isStale: true,
      },
    }
  }
}

export async function runSync(client: SupabaseClient = supabase): Promise<ExtensionState> {
  if (activeSyncHandler) {
    return activeSyncHandler(client)
  }
  return defaultSync(client)
}

/**
 * Core message dispatcher with serialized execution.
 */
export async function handleExtensionMessage(
  message: ExtensionMessage,
  client: SupabaseClient = supabase
): Promise<ExtensionResult> {
  return controllerMutex.runExclusive(async () => {
    try {
      switch (message.type) {
        case 'get-state': {
          const auth = await restoreSession(client)
          if (auth.status !== 'authenticated' || !auth.user) {
            return {
              ok: true,
              data: {
                status: 'unauthenticated',
                user: null,
                todayTasks: [],
                syncMetadata: {
                  lastSuccessfulSyncAt: null,
                  lastSyncError: null,
                  isStale: false,
                },
              } as ExtensionState,
            }
          }

          const cached = await getUserCache(auth.user.id)
          if (!cached) {
            const synced = await runSync(client)
            return { ok: true, data: synced }
          }

          return {
            ok: true,
            data: {
              status: 'authenticated',
              user: auth.user,
              todayTasks: cached.todayTasks,
              syncMetadata: cached.metadata,
            } as ExtensionState,
          }
        }

        case 'sign-in': {
          const user = await signIn(client, message.payload)
          const state = await runSync(client)
          return { ok: true, data: { user, state } }
        }

        case 'sign-out': {
          const auth = await restoreSession(client)
          if (auth.user) {
            await removeUserCache(auth.user.id)
          }
          await signOut(client)
          await clearAllNotificationContexts()
          return { ok: true, data: null }
        }

        case 'sync': {
          const state = await runSync(client)
          return { ok: true, data: state }
        }

        case 'quick-add': {
          const auth = await restoreSession(client)
          if (auth.status !== 'authenticated' || !auth.user) {
            return { ok: false, error: 'Not authenticated' }
          }
          const task = await quickAddTask(
            client,
            auth.user.id,
            message.payload.title,
            auth.user.timezone,
            undefined,
            message.payload.sourceUrl,
            {
              description: message.payload.description,
              priority: message.payload.priority,
              dueOption: message.payload.dueOption,
            }
          )
          await runSync(client)
          return { ok: true, data: task }
        }

        case 'complete-task': {
          const auth = await restoreSession(client)
          if (auth.status !== 'authenticated' || !auth.user) {
            return { ok: false, error: 'Not authenticated' }
          }
          const res = await completeTask(
            client,
            auth.user.id,
            message.payload.taskId,
            message.payload.previousUpdatedAt
          )
          await runSync(client)
          return { ok: true, data: res }
        }

        case 'snooze-reminder': {
          const res = await snoozeReminder(
            client,
            message.payload.reminderId,
            message.payload.minutes,
            message.payload.previousUpdatedAt
          )
          await runSync(client)
          return { ok: true, data: res }
        }

        case 'open-task': {
          const webUrl = (import.meta.env.VITE_TABDO_WEB_URL || 'http://localhost:5173').replace(/\/+$/, '')
          const targetUrl = `${webUrl}/tasks/today?taskId=${encodeURIComponent(message.payload.taskId)}`
          if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
            await chrome.tabs.create({ url: targetUrl })
          }
          return { ok: true, data: { url: targetUrl } }
        }

        default: {
          return { ok: false, error: 'Unknown message type' }
        }
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err)
      return { ok: false, error }
    }
  })
}
