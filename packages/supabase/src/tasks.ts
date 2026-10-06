import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExtensionTodayTask } from '@tabdo/types'
import { getLocalDayBoundaries } from '@tabdo/utils'

interface RawTaskRow {
  id: string
  title: string
  status: string
  priority: string
  due_date_kind: string
  due_at: string | null
  updated_at: string
}

/**
 * Fetches active tasks due on or before local end-of-day for the user's timezone.
 */
export async function getExtensionTodayTasks(
  client: SupabaseClient,
  timeZone: string,
  now: Date = new Date()
): Promise<ExtensionTodayTask[]> {
  const { endOfDay } = getLocalDayBoundaries(now, timeZone)

  const { data, error } = await client
    .from('tasks')
    .select('id, title, status, priority, due_date_kind, due_at, updated_at')
    .neq('status', 'done')
    .not('due_at', 'is', null)
    .lte('due_at', endOfDay.toISOString())
    .order('due_at', { ascending: true })
    .limit(100)

  if (error) {
    throw error
  }

  const rows = (data as unknown as RawTaskRow[]) || []
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status as ExtensionTodayTask['status'],
    priority: row.priority as ExtensionTodayTask['priority'],
    dueDateKind: row.due_date_kind as ExtensionTodayTask['dueDateKind'],
    dueAt: row.due_at,
    updatedAt: row.updated_at,
  }))
}

export interface QuickAddExtraOptions {
  description?: string | null
  priority?: 'low' | 'medium' | 'high'
  dueOption?: 'today' | 'tomorrow' | 'inbox'
}

/**
 * Creates a task for the authenticated user and records activity.
 * Sets due date according to dueOption (defaults to local end-of-day today).
 */
export async function quickAddTask(
  client: SupabaseClient,
  userId: string,
  title: string,
  timeZone: string = 'Asia/Ho_Chi_Minh',
  now: Date = new Date(),
  sourceUrl?: string | null,
  extra?: QuickAddExtraOptions
): Promise<ExtensionTodayTask> {
  const trimmed = title?.trim()
  if (!trimmed) {
    throw new Error('Task title cannot be blank')
  }
  if (trimmed.length > 500) {
    throw new Error('Task title cannot exceed 500 characters')
  }

  let resolvedDueAt: string | null = null
  let resolvedDueDateKind: 'date_only' | 'date_time' = 'date_only'

  if (extra?.dueOption === 'inbox') {
    resolvedDueAt = null
    resolvedDueDateKind = 'date_time'
  } else if (extra?.dueOption === 'tomorrow') {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const { endOfDay } = getLocalDayBoundaries(tomorrow, timeZone)
    resolvedDueAt = endOfDay.toISOString()
    resolvedDueDateKind = 'date_only'
  } else {
    // Default: 'today'
    const { endOfDay } = getLocalDayBoundaries(now, timeZone)
    resolvedDueAt = endOfDay.toISOString()
    resolvedDueDateKind = 'date_only'
  }

  const priority = extra?.priority || 'medium'
  const description = extra?.description?.trim() || null

  const { data, error } = await client
    .from('tasks')
    .insert({
      user_id: userId,
      title: trimmed,
      description,
      status: 'todo',
      priority,
      due_date_kind: resolvedDueDateKind,
      due_at: resolvedDueAt,
      source_url: sourceUrl || null,
    })
    .select('id, title, status, priority, due_date_kind, due_at, updated_at')
    .single()

  if (error) {
    throw error
  }

  const row = data as unknown as RawTaskRow

  // Record own-user activity
  await client.from('task_activities').insert({
    user_id: userId,
    task_id: row.id,
    action: 'created',
    metadata: { title: row.title },
  })

  return {
    id: row.id,
    title: row.title,
    status: row.status as ExtensionTodayTask['status'],
    priority: row.priority as ExtensionTodayTask['priority'],
    dueDateKind: row.due_date_kind as ExtensionTodayTask['dueDateKind'],
    dueAt: row.due_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Marks a task as done with optimistic concurrency control and records activity.
 */
export async function completeTask(
  client: SupabaseClient,
  userId: string,
  taskId: string,
  previousUpdatedAt?: string
): Promise<{ id: string; updatedAt: string }> {
  const completedAt = new Date().toISOString()
  let query = client
    .from('tasks')
    .update({
      status: 'done',
      completed_at: completedAt,
    })
    .eq('id', taskId)

  if (previousUpdatedAt) {
    query = query.eq('updated_at', previousUpdatedAt)
  }

  const { data, error } = await query
    .select('id, title, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Task was modified or does not exist (concurrent modification conflict)')
    }
    throw error
  }

  const row = data as { id: string; title: string; updated_at: string }

  // Record own-user activity
  await client.from('task_activities').insert({
    user_id: userId,
    task_id: taskId,
    action: 'completed',
    metadata: { title: row.title, completedAt },
  })

  return {
    id: row.id,
    updatedAt: row.updated_at,
  }
}
