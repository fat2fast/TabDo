import type { SupabaseClient } from '@supabase/supabase-js'
import { completeTask, markReminderTriggered, snoozeReminder } from '@tabdo/supabase'
import { deriveAlarmName } from '@tabdo/utils'
import { restoreSession } from './auth.js'
import {
  getActiveUserId,
  getNotificationContext,
  getUserCache,
  removeNotificationContext,
  setNotificationContext,
} from './storage.js'
import { supabase } from './supabase.js'
import { syncExtensionState } from './sync.js'
import type { ExtensionNotificationContext } from './types.js'

export const NOTIFICATION_BUTTON_DONE = 0
export const NOTIFICATION_BUTTON_SNOOZE = 1

export const BUTTON_DONE_LABEL = 'Hoàn thành'
export const BUTTON_SNOOZE_LABEL = 'Hoãn 15 phút'

export function getTaskDeepLinkUrl(taskId: string): string {
  const webUrl = (import.meta.env.VITE_TABDO_WEB_URL || 'http://localhost:5173').replace(/\/+$/, '')
  return `${webUrl}/tasks/today?taskId=${encodeURIComponent(taskId)}`
}

/**
 * Renders a Chrome desktop notification for a triggered reminder alarm.
 */
export async function showReminderNotification(
  alarmName: string,
  client: SupabaseClient = supabase
): Promise<void> {
  const reminderId = alarmName.replace(/^reminder:/, '')
  const activeUserId = await getActiveUserId()
  if (!activeUserId) {
    console.warn('[TabDo Notification] No active user ID for alarm:', alarmName)
    await syncExtensionState(client)
    return
  }

  const cache = await getUserCache(activeUserId)
  if (!cache) {
    console.warn('[TabDo Notification] No cache for user:', activeUserId)
    await syncExtensionState(client)
    return
  }

  const reminder = cache.upcomingReminders.find((r) => r.id === reminderId)
  if (!reminder || reminder.taskStatus === 'done') {
    console.warn('[TabDo Notification] Reminder not found in cache or task done:', reminderId)
    // Missing context or task completed -> re-sync and skip displaying inaccurate notification
    await syncExtensionState(client)
    return
  }

  const notificationId = `notif:${reminder.id}:${Date.now()}`
  const context: ExtensionNotificationContext = {
    notificationId,
    reminderId: reminder.id,
    taskId: reminder.taskId,
    taskTitle: reminder.taskTitle,
    dueAt: reminder.dueAt || null,
    effectiveAt: reminder.effectiveAt,
    reminderUpdatedAt: reminder.updatedAt,
    taskUpdatedAt: reminder.taskUpdatedAt,
  }

  await setNotificationContext(notificationId, context)

  const message = reminder.dueAt ? `Hạn chót: ${reminder.dueAt}` : 'Đã đến giờ nhắc nhở công việc.'
  const iconUrl =
    typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('icon/128.png')
      : '/icon/128.png'

  if (typeof chrome !== 'undefined' && chrome.notifications?.create) {
    console.log('[TabDo Notification] Creating notification:', notificationId, reminder.taskTitle)
    await chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl,
      title: reminder.taskTitle,
      message,
      buttons: [
        { title: BUTTON_DONE_LABEL },
        { title: BUTTON_SNOOZE_LABEL },
      ],
      requireInteraction: true,
    })
  }

  // Best-effort status update
  await markReminderTriggered(client, reminder.id, reminder.updatedAt)
}

/**
 * Handles action button clicks on a reminder notification (Done or Snooze 15m).
 */
export async function handleNotificationButtonClick(
  notificationId: string,
  buttonIndex: number,
  client: SupabaseClient = supabase
): Promise<void> {
  const context = await getNotificationContext(notificationId)
  if (!context) return

  try {
    if (buttonIndex === NOTIFICATION_BUTTON_DONE) {
      await handleDone(context, client)
    } else if (buttonIndex === NOTIFICATION_BUTTON_SNOOZE) {
      await handleSnooze(context, 15, client)
    }
  } finally {
    if (typeof chrome !== 'undefined' && chrome.notifications?.clear) {
      await chrome.notifications.clear(notificationId)
    }
    await removeNotificationContext(notificationId)
  }
}

/**
 * Handles clicking the notification body to open the task in the web app drawer.
 */
export async function handleNotificationClicked(
  notificationId: string,
  _client: SupabaseClient = supabase
): Promise<void> {
  const context = await getNotificationContext(notificationId)
  if (!context) return

  const url = getTaskDeepLinkUrl(context.taskId)

  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    await chrome.tabs.create({ url })
  }

  if (typeof chrome !== 'undefined' && chrome.notifications?.clear) {
    await chrome.notifications.clear(notificationId)
  }
  await removeNotificationContext(notificationId)
}

/**
 * Remote-first task completion and alarm cleanup.
 */
export async function handleDone(
  context: ExtensionNotificationContext,
  client: SupabaseClient = supabase
): Promise<void> {
  const auth = await restoreSession(client)
  if (!auth.user) {
    throw new Error('Not authenticated')
  }

  // 1. Remote mutation
  await completeTask(client, auth.user.id, context.taskId, context.taskUpdatedAt)

  // 2. Clear local alarm for this reminder immediately
  if (typeof chrome !== 'undefined' && chrome.alarms) {
    await chrome.alarms.clear(deriveAlarmName(context.reminderId))
  }

  // 3. Full sync to converge any remaining alarms/cache
  await syncExtensionState(client)
}

/**
 * Remote-first snooze and alarm rescheduling.
 */
export async function handleSnooze(
  context: ExtensionNotificationContext,
  minutes: number = 15,
  client: SupabaseClient = supabase
): Promise<void> {
  // 1. Remote mutation
  const res = await snoozeReminder(
    client,
    context.reminderId,
    minutes,
    context.reminderUpdatedAt
  )

  // 2. Clear previous alarm and reschedule locally at new effectiveAt
  const alarmName = deriveAlarmName(context.reminderId)
  if (typeof chrome !== 'undefined' && chrome.alarms) {
    await chrome.alarms.clear(alarmName)
    chrome.alarms.create(alarmName, {
      when: new Date(res.effectiveAt).getTime(),
    })
  }

  // 3. Sync state
  await syncExtensionState(client)
}
