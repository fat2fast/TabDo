import type { SupabaseClient } from '@supabase/supabase-js'
import { getExtensionTodayTasks, getUpcomingReminders } from '@tabdo/supabase'
import { deriveAlarmName } from '@tabdo/utils'
import { clearReminderAlarms, reconcileReminderAlarms } from './alarm-reconciliation.js'
import { restoreSession } from './auth.js'
import {
  getUserCache,
  setUserCache,
  storageGet,
} from './storage.js'
import { supabase } from './supabase.js'
import type {
  ExistingAlarmSnapshot,
  ExtensionState,
  ExtensionSyncMetadata,
  ExtensionUserCache,
} from './types.js'

export { clearReminderAlarms }

export const PERIODIC_SYNC_ALARM_NAME = 'tabdo:sync:periodic'
export const SYNC_INTERVAL_MINUTES = 15

export async function ensurePeriodicSyncAlarm(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.alarms) return
  const existing = await chrome.alarms.get(PERIODIC_SYNC_ALARM_NAME)
  if (!existing) {
    chrome.alarms.create(PERIODIC_SYNC_ALARM_NAME, {
      periodInMinutes: SYNC_INTERVAL_MINUTES,
    })
  }
}


export async function clearTaskAlarms(taskId: string): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.alarms) return
  // Clear any alarm matching reminder for this taskId from cache
  const activeUserId = await storageGet<string>('tabdo:auth:active_user_id')
  if (!activeUserId) return
  const cache = await getUserCache(activeUserId)
  if (!cache) return
  for (const reminder of cache.upcomingReminders) {
    if (reminder.taskId === taskId) {
      await chrome.alarms.clear(deriveAlarmName(reminder.id))
    }
  }
}

/**
 * Remote-first synchronization of today tasks and upcoming reminders.
 * Converges Chrome alarms with the remote 7-day upcoming reminders projection.
 */
export async function syncExtensionState(
  client: SupabaseClient = supabase
): Promise<ExtensionState> {
  const auth = await restoreSession(client)
  if (auth.status !== 'authenticated' || !auth.user) {
    await clearReminderAlarms()
    return {
      status: auth.status,
      user: auth.user,
      todayTasks: [],
      syncMetadata: {
        lastSuccessfulSyncAt: null,
        lastSyncError: null,
        isStale: false,
      },
    }
  }

  try {
    const reminderWindowStart = new Date(Date.now() - 2 * 60 * 1000)
    const [todayTasks, upcomingReminders] = await Promise.all([
      getExtensionTodayTasks(client, auth.user.timezone),
      getUpcomingReminders(client, reminderWindowStart),
    ])

    // Alarm reconciliation
    if (typeof chrome !== 'undefined' && chrome.alarms) {
      const chromeAlarms = await chrome.alarms.getAll()
      const snapshots: ExistingAlarmSnapshot[] = chromeAlarms.map((a) => ({
        name: a.name,
        scheduledTime: a.scheduledTime,
      }))

      const { alarmsToCreate, alarmsToRemove } = reconcileReminderAlarms(
        upcomingReminders,
        snapshots
      )

      for (const name of alarmsToRemove) {
        await chrome.alarms.clear(name)
      }
      for (const { name, scheduledTime } of alarmsToCreate) {
        chrome.alarms.create(name, { when: scheduledTime })
      }

      await ensurePeriodicSyncAlarm()

      console.log(
        `[TabDo Sync] State synchronized. Tasks: ${todayTasks.length}, Upcoming reminders: ${upcomingReminders.length}. Alarms created: ${alarmsToCreate.length}, Alarms removed: ${alarmsToRemove.length}`
      )
    }

    const metadata: ExtensionSyncMetadata = {
      lastSuccessfulSyncAt: new Date().toISOString(),
      lastSyncError: null,
      isStale: false,
    }

    const newCache: ExtensionUserCache = {
      userId: auth.user.id,
      todayTasks,
      upcomingReminders,
      metadata,
    }

    await setUserCache(auth.user.id, newCache)

    return {
      status: 'authenticated',
      user: auth.user,
      todayTasks,
      syncMetadata: metadata,
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    const existingCache = await getUserCache(auth.user.id)
    const staleMetadata: ExtensionSyncMetadata = {
      lastSuccessfulSyncAt: existingCache?.metadata.lastSuccessfulSyncAt || null,
      lastSyncError: errorMessage,
      isStale: true,
    }

    if (existingCache) {
      await setUserCache(auth.user.id, {
        ...existingCache,
        metadata: staleMetadata,
      })
    }

    return {
      status: 'authenticated',
      user: auth.user,
      todayTasks: existingCache?.todayTasks || [],
      syncMetadata: staleMetadata,
    }
  }
}
