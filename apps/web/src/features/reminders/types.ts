import type {
  CreateReminderInput,
  DeleteReminderInput,
  Reminder,
  ReminderKind,
  ReminderStatus,
  UpcomingReminder,
  UpdateReminderInput,
} from '@tabdo/types'

export type {
  CreateReminderInput,
  DeleteReminderInput,
  Reminder,
  ReminderKind,
  ReminderStatus,
  UpcomingReminder,
  UpdateReminderInput,
}

export interface ReminderRow {
  id: string
  user_id: string
  task_id: string
  remind_at: string
  status: ReminderStatus
  snoozed_until: string | null
  reminder_kind: ReminderKind
  offset_minutes: number | null
  effective_at: string
  created_at: string
  updated_at: string
}

export function toReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    userId: row.user_id,
    taskId: row.task_id,
    remindAt: row.remind_at,
    status: row.status,
    snoozedUntil: row.snoozed_until,
    reminderKind: row.reminder_kind,
    offsetMinutes: row.offset_minutes,
    effectiveAt: row.effective_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
