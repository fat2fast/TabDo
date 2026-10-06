import { formatInTimeZone } from 'date-fns-tz'

export interface ReminderPresetOption {
  offsetMinutes: number
  label: string
}

export const RELATIVE_REMINDER_PRESETS: ReminderPresetOption[] = [
  { offsetMinutes: 0, label: 'Đúng thời hạn' },
  { offsetMinutes: 5, label: 'Trước 5 phút' },
  { offsetMinutes: 15, label: 'Trước 15 phút' },
  { offsetMinutes: 30, label: 'Trước 30 phút' },
  { offsetMinutes: 60, label: 'Trước 1 giờ' },
  { offsetMinutes: 1440, label: 'Trước 1 ngày' },
]

export const SNOOZE_PRESETS: { minutes: number; label: string }[] = [
  { minutes: 15, label: 'Hoãn 15 phút' },
  { minutes: 30, label: 'Hoãn 30 phút' },
  { minutes: 60, label: 'Hoãn 1 giờ' },
]

/**
 * Derives UTC ISO instant for a relative reminder given a task due instant and non-negative offset in minutes.
 */
export function resolveRelativeReminderInstant(
  dueAt: string | Date,
  offsetMinutes: number
): string {
  const dueDate = typeof dueAt === 'string' ? new Date(dueAt) : dueAt
  const timeMs = dueDate.getTime() - offsetMinutes * 60 * 1000
  return new Date(timeMs).toISOString()
}

/**
 * Derives UTC ISO instant for snoozing from a reference instant `now`.
 */
export function resolveSnoozeInstant(now: Date, snoozeMinutes: number): string {
  return new Date(now.getTime() + snoozeMinutes * 60 * 1000).toISOString()
}

/**
 * Derives the stable Chrome/extension alarm name for a reminder.
 */
export function deriveAlarmName(reminderId: string): string {
  return `reminder:${reminderId}`
}

/**
 * Derives the isolated storage cache namespace for an authenticated user and schema version.
 */
export function deriveCacheNamespace(userId: string, schemaVersion: number = 1): string {
  return `tabdo:reminders:v${schemaVersion}:${userId}`
}

/**
 * Formats a reminder execution instant for user display in the specified IANA timeZone.
 */
export function formatReminderDisplay(instant: string | Date, timeZone: string): string {
  const date = typeof instant === 'string' ? new Date(instant) : instant
  return formatInTimeZone(date, timeZone, 'dd/MM/yyyy HH:mm')
}
