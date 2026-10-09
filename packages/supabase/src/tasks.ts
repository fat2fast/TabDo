import type { SupabaseClient } from '@supabase/supabase-js'
import type { CompleteTaskAndGenerateNextResult, ExtensionTodayTask, Task } from '@tabdo/types'
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


function mapRawRowToTask(row: Record<string, unknown>): Task {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    categoryId: (row.category_id as string) ?? null,
    parentId: (row.parent_id as string) ?? null,
    title: String(row.title),
    description: (row.description as string) ?? null,
    status: row.status as Task['status'],
    priority: row.priority as Task['priority'],
    dueDateKind: row.due_date_kind as Task['dueDateKind'],
    startAt: (row.start_at as string) ?? null,
    dueAt: (row.due_at as string) ?? null,
    sourceUrl: (row.source_url as string) ?? null,
    completedAt: (row.completed_at as string) ?? null,
    recurrenceRule: (row.recurrence_rule as string) ?? null,
    recurrenceSeriesId: (row.recurrence_series_id as string) ?? null,
    recurrenceParentId: (row.recurrence_parent_id as string) ?? null,
    recurrenceTimezone: (row.recurrence_timezone as string) ?? null,
    recurrenceAnchorAt: (row.recurrence_anchor_at as string) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

/**
 * Atomically completes a task and generates its successor occurrence (if recurring)
 * using the complete_task_and_generate_next RPC.
 */
export async function completeTaskAndGenerateNext(
  client: SupabaseClient,
  taskId: string,
  expectedUpdatedAt?: string
): Promise<CompleteTaskAndGenerateNextResult> {
  const { data, error } = await client.rpc('complete_task_and_generate_next', {
    p_task_id: taskId,
    p_expected_updated_at: expectedUpdatedAt || null,
  })

  if (error) {
    if (error.code === '40001' || error.message?.includes('concurrent')) {
      throw new Error('Task was modified or does not exist (concurrent modification conflict)')
    }
    throw error
  }

  const res = data as {
    completedTask: Record<string, unknown>
    nextTask: Record<string, unknown> | null
    generated: boolean
    reusedExistingSuccessor: boolean
  }

  return {
    completedTask: mapRawRowToTask(res.completedTask),
    nextTask: res.nextTask ? mapRawRowToTask(res.nextTask) : null,
    generated: res.generated,
    reusedExistingSuccessor: res.reusedExistingSuccessor,
  }
}

/**
 * Marks a task as done using the atomic complete_task_and_generate_next RPC.
 */
export async function completeTask(
  client: SupabaseClient,
  _userId: string,
  taskId: string,
  previousUpdatedAt?: string
): Promise<{ id: string; updatedAt: string }> {
  const result = await completeTaskAndGenerateNext(client, taskId, previousUpdatedAt)
  return {
    id: result.completedTask.id,
    updatedAt: result.completedTask.updatedAt,
  }
}
