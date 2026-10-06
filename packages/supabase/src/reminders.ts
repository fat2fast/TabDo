import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReminderKind, ReminderStatus, TaskStatus, UpcomingReminder } from '@tabdo/types'
import { resolveSnoozeInstant } from '@tabdo/utils'

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

/**
 * Best-effort updates reminder status to triggered after notification display.
 */
export async function markReminderTriggered(
  client: SupabaseClient,
  reminderId: string,
  previousUpdatedAt?: string
): Promise<boolean> {
  try {
    let query = client
      .from('reminders')
      .update({ status: 'triggered' })
      .eq('id', reminderId)

    if (previousUpdatedAt) {
      query = query.eq('updated_at', previousUpdatedAt)
    }

    const { error } = await query
    return !error
  } catch {
    return false
  }
}

/**
 * Snoozes a reminder by updating snoozed_until and effective_at with optimistic concurrency.
 */
export async function snoozeReminder(
  client: SupabaseClient,
  reminderId: string,
  snoozeMinutes: number,
  previousUpdatedAt?: string,
  now: Date = new Date()
): Promise<{ id: string; snoozedUntil: string; effectiveAt: string; updatedAt: string }> {
  const snoozedUntil = resolveSnoozeInstant(now, snoozeMinutes)

  let query = client
    .from('reminders')
    .update({
      status: 'snoozed',
      snoozed_until: snoozedUntil,
    })
    .eq('id', reminderId)

  if (previousUpdatedAt) {
    query = query.eq('updated_at', previousUpdatedAt)
  }

  const { data, error } = await query
    .select('id, snoozed_until, effective_at, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Reminder was modified or does not exist (concurrent modification conflict)')
    }
    throw error
  }

  const row = data as {
    id: string
    snoozed_until: string
    effective_at: string
    updated_at: string
  }

  return {
    id: row.id,
    snoozedUntil: row.snoozed_until,
    effectiveAt: row.effective_at,
    updatedAt: row.updated_at,
  }
}
