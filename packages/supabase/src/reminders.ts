import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReminderKind, ReminderStatus, TaskStatus, UpcomingReminder } from '@tabdo/types'

interface RawUpcomingReminderRow {
  id: string
  task_id: string
  remind_at: string
  status: string
  snoozed_until: string | null
  reminder_kind: string
  offset_minutes: number | null
  effective_at: string
  updated_at: string
  tasks: {
    id: string
    title: string
    status: string
    due_at: string | null
    updated_at: string
  } | null
}

/**
 * Fetches upcoming pending or snoozed reminders for the authenticated user within the next 7 days.
 * Excludes userId to preserve client-boundary isolation.
 */
export async function getUpcomingReminders(
  client: SupabaseClient,
  now: Date = new Date()
): Promise<UpcomingReminder[]> {
  const windowStart = now.toISOString()
  const windowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await client
    .from('reminders')
    .select(`
      id,
      task_id,
      remind_at,
      status,
      snoozed_until,
      reminder_kind,
      offset_minutes,
      effective_at,
      updated_at,
      tasks!inner (
        id,
        title,
        status,
        due_at,
        updated_at
      )
    `)
    .in('status', ['pending', 'snoozed'])
    .gte('effective_at', windowStart)
    .lt('effective_at', windowEnd)
    .order('effective_at', { ascending: true })

  if (error) {
    throw error
  }

  const rows = (data as unknown as RawUpcomingReminderRow[]) || []

  return rows
    .filter((row) => row.tasks !== null)
    .map((row) => ({
      id: row.id,
      taskId: row.task_id,
      taskTitle: row.tasks!.title,
      taskStatus: row.tasks!.status as TaskStatus,
      dueAt: row.tasks!.due_at,
      reminderKind: row.reminder_kind as ReminderKind,
      offsetMinutes: row.offset_minutes,
      remindAt: row.remind_at,
      effectiveAt: row.effective_at,
      status: row.status as ReminderStatus,
      snoozedUntil: row.snoozed_until,
      updatedAt: row.updated_at,
      taskUpdatedAt: row.tasks!.updated_at,
    }))
}
