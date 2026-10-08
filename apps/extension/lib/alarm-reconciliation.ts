import { deriveAlarmName } from '@tabdo/utils'
import type {
  AlarmReconciliationResult,
  DesiredAlarm,
  ExistingAlarmSnapshot,
} from './types.js'

export interface ReconcileReminderInput {
  id: string
  effectiveAt: string
}

const REMINDER_PREFIX = 'reminder:'

/**
 * Pure comparison between desired upcoming reminders and existing Chrome alarms.
 * - Ignores non-reminder alarms (such as periodic sync).
 * - Identifies orphaned alarms for removal.
 * - Identifies changed alarm times as removal + re-creation.
 * - Identifies new alarms for creation.
 * - Unchanged alarms produce no actions.
 */
export function reconcileReminderAlarms(
  desiredReminders: readonly ReconcileReminderInput[],
  existingAlarms: readonly ExistingAlarmSnapshot[]
): AlarmReconciliationResult {
  const existingReminderAlarms = new Map<string, number>()
  for (const alarm of existingAlarms) {
    if (alarm.name.startsWith(REMINDER_PREFIX)) {
      existingReminderAlarms.set(alarm.name, alarm.scheduledTime)
    }
  }

  const desiredReminderAlarms = new Map<string, number>()
  for (const reminder of desiredReminders) {
    const alarmName = deriveAlarmName(reminder.id)
    const scheduledTime = new Date(reminder.effectiveAt).getTime()
    desiredReminderAlarms.set(alarmName, scheduledTime)
  }

  const alarmsToRemove: string[] = []
  const alarmsToCreate: DesiredAlarm[] = []

  // Check existing alarms for orphans or time changes
  for (const [name, existingTime] of existingReminderAlarms.entries()) {
    const desiredTime = desiredReminderAlarms.get(name)
    if (desiredTime === undefined) {
      // Remote omission -> remove
      alarmsToRemove.push(name)
    } else if (desiredTime !== existingTime) {
      // Time changed -> remove existing first
      alarmsToRemove.push(name)
    }
  }

  // Check desired alarms for new entries or time changes
  for (const [name, desiredTime] of desiredReminderAlarms.entries()) {
    const existingTime = existingReminderAlarms.get(name)
    if (existingTime === undefined || existingTime !== desiredTime) {
      alarmsToCreate.push({
        name,
        scheduledTime: desiredTime,
      })
    }
  }

  return {
    alarmsToCreate,
    alarmsToRemove,
  }
}

/**
 * Removes all reminder:* alarms from chrome.alarms.
 * Used during sign-out, invalid-session recovery, and unauthenticated sync cleanup.
 */
export async function clearReminderAlarms(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.alarms) return
  const allAlarms = await chrome.alarms.getAll()
  for (const alarm of allAlarms) {
    if (alarm.name.startsWith(REMINDER_PREFIX)) {
      await chrome.alarms.clear(alarm.name)
    }
  }
}

