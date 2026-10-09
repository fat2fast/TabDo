import type { SupabaseClient } from '@supabase/supabase-js'
import { completeTask, markReminderTriggered, snoozeReminder } from '@tabdo/supabase'
import { deriveAlarmName } from '@tabdo/utils'
import { restoreSession } from './auth.js'
import { controllerMutex } from './controller.js'
import {
  getActiveUserId,
  getNotificationContext,
  getUserCache,
  removeNotificationContext,
  setNotificationContext,
  setUserCache,
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
  if (client.auth && typeof client.auth.getSession === 'function') {
    const auth = await restoreSession(client)
    if (auth.status !== 'authenticated' || !auth.user) {
      console.warn('[TabDo Notification] Account not authenticated or inactive for alarm:', alarmName)
      await syncExtensionState(client)
      return
    }
  }

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

  // Best-effort status update: persist new updatedAt if available to avoid optimistic-concurrency conflicts
  const triggerResult = await markReminderTriggered(client, reminder.id, reminder.updatedAt)
  if (triggerResult?.success && triggerResult.updatedAt) {
    context.reminderUpdatedAt = triggerResult.updatedAt
    await setNotificationContext(notificationId, context)
  }
}

/**
 * Handles action button clicks on a reminder notification (Done or Snooze 15m).
 * Serialized through controllerMutex to prevent races with background syncs.
 */
export async function handleNotificationButtonClick(
  notificationId: string,
  buttonIndex: number,
  client: SupabaseClient = supabase
): Promise<void> {
  return controllerMutex.runExclusive(async () => {
    const context = await getNotificationContext(notificationId)
    if (!context) return

    if (client.auth && typeof client.auth.getSession === 'function') {
      const auth = await restoreSession(client)
      if (auth.status !== 'authenticated' || !auth.user) {
        const err = auth.status === 'inactive'
          ? 'Account is inactive'
          : auth.status === 'password_change_required'
          ? 'Password change required'
          : 'Not authenticated'
        throw new Error(err)
      }
    }

    try {
      if (buttonIndex === NOTIFICATION_BUTTON_DONE) {
        await handleDone(context, client)
      } else if (buttonIndex === NOTIFICATION_BUTTON_SNOOZE) {
        await handleSnooze(context, 15, client)
      }

      // Success path: clear notification and remove context
      if (typeof chrome !== 'undefined' && chrome.notifications?.clear) {
        await chrome.notifications.clear(notificationId)
      }
      await removeNotificationContext(notificationId)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('[TabDo Notification] Action failed:', errorMessage)

      // Surface user-visible error in active user cache metadata
      const activeUserId = await getActiveUserId()
      if (activeUserId) {
        const cache = await getUserCache(activeUserId)
        if (cache) {
          await setUserCache(activeUserId, {
            ...cache,
            metadata: {
              ...cache.metadata,
              lastSyncError: errorMessage,
              isStale: true,
            },
          })
        }
      }

      // Preserve recovery path: do not clear notification, update title/message if possible
      if (typeof chrome !== 'undefined' && chrome.notifications?.update) {
        await chrome.notifications.update(notificationId, {
          title: `${context.taskTitle} (Thất bại)`,
          message: `Không thể thực hiện thao tác: ${errorMessage}. Bấm để mở hoặc thử lại.`,
        })
      }

      throw err
    }
  })
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
 *
 * Clears ALL local alarms belonging to the completed task's reminders before
 * the reconciliation sync, so stale alarms cannot fire if the sync later fails.
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

  // 2. Eagerly clear ALL local alarms for every reminder of the completed source task.
  //    This must happen before the sync so that even if the sync fails, no stale
  //    reminder alarm for the now-completed task can fire.
  if (typeof chrome !== 'undefined' && chrome.alarms) {
    const activeUserId = await getActiveUserId()
    if (activeUserId) {
      const cache = await getUserCache(activeUserId)
      if (cache) {
        const taskReminders = cache.upcomingReminders.filter(
          (r) => r.taskId === context.taskId
        )
        await Promise.all(
          taskReminders.map((r) => chrome.alarms.clear(deriveAlarmName(r.id)))
        )
      }
    }
    // Also clear the specific alarm from the triggering notification (belt-and-suspenders)
    await chrome.alarms.clear(deriveAlarmName(context.reminderId))
  }

  // 3. Full sync to converge remaining alarms/cache
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
