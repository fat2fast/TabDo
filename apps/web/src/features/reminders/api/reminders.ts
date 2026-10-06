import type { SupabaseClient } from '@supabase/supabase-js'
import { getUpcomingReminders as getUpcomingRemindersShared } from '@tabdo/supabase'
import { supabase as defaultClient } from '../../../lib/supabase'
import type {
  CreateReminderInput,
  Reminder,
  ReminderRow,
  UpcomingReminder,
  UpdateReminderInput,
} from '../types'
import { toReminder } from '../types'

export async function getRemindersByTask(
  client: SupabaseClient = defaultClient,
  taskId: string
): Promise<Reminder[]> {
  const { data, error } = await client
    .from('reminders')
    .select('*')
    .eq('task_id', taskId)
    .order('effective_at', { ascending: true })

  if (error) throw error
  return (data as ReminderRow[]).map(toReminder)
}

export async function getUpcomingRemindersWeb(
  client: SupabaseClient = defaultClient,
  now: Date = new Date()
): Promise<UpcomingReminder[]> {
  return getUpcomingRemindersShared(client, now)
}

export async function createReminder(
  client: SupabaseClient = defaultClient,
  input: CreateReminderInput
): Promise<Reminder> {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser()

  if (authError || !user) {
    throw new Error('User must be authenticated to create reminders')
  }

  const payload: Record<string, unknown> = {
    user_id: user.id,
    task_id: input.taskId,
    reminder_kind: input.reminderKind,
    status: 'pending',
  }

  if (input.reminderKind === 'relative_due') {
    if (input.offsetMinutes === undefined || input.offsetMinutes === null || input.offsetMinutes < 0) {
      throw new Error('Relative reminder requires a non-negative offset_minutes')
    }
    payload.offset_minutes = input.offsetMinutes
    // Database trigger will derive remind_at from task due_at, but schema requires not null remind_at
    payload.remind_at = input.remindAt || new Date().toISOString()
  } else {
    if (!input.remindAt) {
      throw new Error('Absolute reminder requires remindAt instant')
    }
    payload.offset_minutes = null
    payload.remind_at = input.remindAt
  }

  const { data, error } = await client
    .from('reminders')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return toReminder(data as ReminderRow)
}

export async function updateReminder(
  client: SupabaseClient = defaultClient,
  id: string,
  input: UpdateReminderInput
): Promise<Reminder> {
  const payload: Record<string, unknown> = {}

  if (input.reminderKind !== undefined) payload.reminder_kind = input.reminderKind
  if (input.offsetMinutes !== undefined) payload.offset_minutes = input.offsetMinutes
  if (input.remindAt !== undefined) payload.remind_at = input.remindAt
  if (input.status !== undefined) payload.status = input.status
  if (input.snoozedUntil !== undefined) payload.snoozed_until = input.snoozedUntil

  // If status is not provided and user changes time/kind, reset status to pending
  if (input.status === undefined && (input.remindAt !== undefined || input.offsetMinutes !== undefined)) {
    payload.status = 'pending'
    payload.snoozed_until = null
  }

  const { data, error } = await client
    .from('reminders')
    .update(payload)
    .eq('id', id)
    .eq('updated_at', input.previousUpdatedAt)
    .select()

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('Reminder was updated or deleted by another session. Please refresh.')
  }

  return toReminder(data[0] as ReminderRow)
}

export async function snoozeReminder(
  client: SupabaseClient = defaultClient,
  id: string,
  snoozedUntil: string,
  previousUpdatedAt: string
): Promise<Reminder> {
  const { data, error } = await client
    .from('reminders')
    .update({
      status: 'snoozed',
      snoozed_until: snoozedUntil,
    })
    .eq('id', id)
    .eq('updated_at', previousUpdatedAt)
    .select()

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('Reminder was updated or deleted by another session. Please refresh.')
  }

  return toReminder(data[0] as ReminderRow)
}

export async function dismissReminder(
  client: SupabaseClient = defaultClient,
  id: string,
  previousUpdatedAt: string
): Promise<Reminder> {
  const { data, error } = await client
    .from('reminders')
    .update({
      status: 'dismissed',
      snoozed_until: null,
    })
    .eq('id', id)
    .eq('updated_at', previousUpdatedAt)
    .select()

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('Reminder was updated or deleted by another session. Please refresh.')
  }

  return toReminder(data[0] as ReminderRow)
}

export async function deleteReminder(
  client: SupabaseClient = defaultClient,
  id: string,
  previousUpdatedAt: string
): Promise<void> {
  const { data, error } = await client
    .from('reminders')
    .delete()
    .eq('id', id)
    .eq('updated_at', previousUpdatedAt)
    .select()

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('Reminder was updated or deleted by another session. Please refresh.')
  }
}
