import { getLocalDayBoundaries } from '@tabdo/utils'
import { supabase } from '../../../lib/supabase'
import {
  type CreateTaskInput,
  type Task,
  type TaskListQueryInput,
  type TaskRow,
  type UpdateTaskInput,
  rowToTask,
} from '../types'
import { recordTaskActivity } from './task-activities'

export async function getTaskList(input: TaskListQueryInput): Promise<Task[]> {
  let query = supabase.from('tasks').select('*')

  // Apply smart view predicates
  switch (input.view) {
    case 'inbox': {
      // 'All Tasks' view: displays all tasks without restricting due_at
      if (!input.status) {
        query = query.neq('status', 'done')
      }
      break
    }
    case 'today': {
      const { endOfDay } = getLocalDayBoundaries(input.now, input.timeZone)
      // Active tasks due on or before local end-of-today (includes overdue + due today)
      query = query
        .neq('status', 'done')
        .not('due_at', 'is', null)
        .lte('due_at', endOfDay.toISOString())
      break
    }
    case 'upcoming': {
      const { endOfDay } = getLocalDayBoundaries(input.now, input.timeZone)
      // Active tasks due after local end-of-today
      query = query
        .neq('status', 'done')
        .not('due_at', 'is', null)
        .gt('due_at', endOfDay.toISOString())
      break
    }
    case 'overdue': {
      query = query
        .neq('status', 'done')
        .not('due_at', 'is', null)
        .lt('due_at', input.now.toISOString())
      break
    }
    case 'completed': {
      query = query.eq('status', 'done')
      break
    }
  }

  // Scope filter (e.g. Unorganized / No due date / Uncategorized)
  if (input.scope === 'unorganized') {
    query = query.or('category_id.is.null,due_at.is.null')
  } else if (input.scope === 'no_due') {
    query = query.is('due_at', null)
  } else if (input.scope === 'uncategorized') {
    query = query.is('category_id', null)
  }

  // Filter overrides if provided
  if (input.search && input.search.trim()) {
    query = query.ilike('title', `%${input.search.trim()}%`)
  }
  if (input.status) {
    query = query.eq('status', input.status)
  }
  if (input.priority) {
    query = query.eq('priority', input.priority)
  }
  if (input.categoryId !== undefined) {
    if (input.categoryId === null || input.categoryId === 'none') {
      query = query.is('category_id', null)
    } else if (input.categoryId !== '') {
      query = query.eq('category_id', input.categoryId)
    }
  }
  if (input.dueFrom) {
    query = query.gte('due_at', input.dueFrom)
  }
  if (input.dueTo) {
    query = query.lte('due_at', input.dueTo)
  }

  // Sorting
  if (input.sort && input.sort !== 'default') {
    switch (input.sort) {
      case 'priority':
        query = query
          .order('priority_rank', { ascending: false })
          .order('created_at', { ascending: false })
        break
      case 'due_asc':
        query = query
          .order('due_at', { ascending: true, nullsFirst: false })
          .order('priority_rank', { ascending: false })
        break
      case 'due_desc':
        query = query
          .order('due_at', { ascending: false, nullsFirst: false })
          .order('priority_rank', { ascending: false })
        break
      case 'created_desc':
        query = query.order('created_at', { ascending: false })
        break
      case 'updated_desc':
        query = query.order('updated_at', { ascending: false })
        break
    }
  } else {
    // Default sort per view
    switch (input.view) {
      case 'completed':
        query = query.order('completed_at', { ascending: false })
        break
      case 'today':
      case 'upcoming':
      case 'overdue':
        query = query
          .order('due_at', { ascending: true, nullsFirst: false })
          .order('priority_rank', { ascending: false })
        break
      case 'inbox':
      default:
        query = query.order('created_at', { ascending: false })
        break
    }
  }

  // Bounded limit
  const limit = input.limit ?? (input.view === 'completed' ? 50 : 100)
  query = query.limit(limit)

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return ((data as TaskRow[]) || []).map(rowToTask)
}

export async function getTaskById(id: string): Promise<Task | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ? rowToTask(data as TaskRow) : null
}

export async function getSubtasks(parentId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return ((data as TaskRow[]) || []).map(rowToTask)
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const trimmedTitle = input.title?.trim()
  if (!trimmedTitle) {
    throw new Error('Task title cannot be blank')
  }
  if (trimmedTitle.length > 500) {
    throw new Error('Task title cannot exceed 500 characters')
  }
  if (input.description && input.description.length > 10000) {
    throw new Error('Task description cannot exceed 10,000 characters')
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }

  const payload: Record<string, unknown> = {
    user_id: session.user.id,
    title: trimmedTitle,
    description: input.description || null,
    category_id: input.categoryId || null,
    parent_id: input.parentId || null,
    status: input.status || 'todo',
    priority: input.priority || 'medium',
    due_date_kind: input.dueDateKind || 'date_time',
    start_at: input.startAt || null,
    due_at: input.dueAt || null,
    source_url: input.sourceUrl || null,
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert(payload)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const task = rowToTask(data as TaskRow)

  // Write own-user activity entry
  await recordTaskActivity({
    userId: session.user.id,
    taskId: task.id,
    action: 'created',
    metadata: { title: task.title },
  })

  return task
}

export async function updateTask(
  id: string,
  input: UpdateTaskInput,
  previousTask?: Task
): Promise<Task> {
  const updates: Record<string, unknown> = {}

  if (input.title !== undefined) {
    const trimmed = input.title.trim()
    if (!trimmed) {
      throw new Error('Task title cannot be blank')
    }
    if (trimmed.length > 500) {
      throw new Error('Task title cannot exceed 500 characters')
    }
    updates.title = trimmed
  }

  if (input.description !== undefined) {
    if (input.description && input.description.length > 10000) {
      throw new Error('Task description cannot exceed 10,000 characters')
    }
    updates.description = input.description || null
  }

  if (input.categoryId !== undefined) updates.category_id = input.categoryId || null
  if (input.parentId !== undefined) updates.parent_id = input.parentId || null
  if (input.status !== undefined) updates.status = input.status
  if (input.priority !== undefined) updates.priority = input.priority
  if (input.dueDateKind !== undefined) updates.due_date_kind = input.dueDateKind
  if (input.startAt !== undefined) updates.start_at = input.startAt || null
  if (input.dueAt !== undefined) updates.due_at = input.dueAt || null
  if (input.sourceUrl !== undefined) updates.source_url = input.sourceUrl || null
  if (input.completedAt !== undefined) updates.completed_at = input.completedAt || null

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }

  let query = supabase.from('tasks').update(updates).eq('id', id)
  if (input.previousUpdatedAt) {
    query = query.eq('updated_at', input.previousUpdatedAt)
  }

  const { data, error } = await query.select().single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Task was modified or does not exist (concurrent modification conflict)')
    }
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error('Task was modified or does not exist (concurrent modification conflict)')
  }

  const task = rowToTask(data as TaskRow)

  // Determine activity action
  if (previousTask) {
    if (previousTask.status !== 'done' && task.status === 'done') {
      await recordTaskActivity({
        userId: session.user.id,
        taskId: task.id,
        action: 'completed',
        metadata: { title: task.title, completedAt: task.completedAt },
      })
    } else if (previousTask.status === 'done' && task.status !== 'done') {
      await recordTaskActivity({
        userId: session.user.id,
        taskId: task.id,
        action: 'reopened',
        metadata: { title: task.title, status: task.status },
      })
    } else if (previousTask.priority !== task.priority) {
      await recordTaskActivity({
        userId: session.user.id,
        taskId: task.id,
        action: 'priority_changed',
        metadata: { from: previousTask.priority, to: task.priority },
      })
    } else if (previousTask.dueAt !== task.dueAt) {
      await recordTaskActivity({
        userId: session.user.id,
        taskId: task.id,
        action: 'deadline_changed',
        metadata: { from: previousTask.dueAt, to: task.dueAt },
      })
    } else {
      await recordTaskActivity({
        userId: session.user.id,
        taskId: task.id,
        action: 'updated',
        metadata: { changes: Object.keys(updates) },
      })
    }
  } else {
    await recordTaskActivity({
      userId: session.user.id,
      taskId: task.id,
      action: 'updated',
      metadata: { changes: Object.keys(updates) },
    })
  }

  return task
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) {
    throw new Error(error.message)
  }
  // Deliberately do not insert activity for hard deletion because FK cascades
}

export async function completeTask(task: Task): Promise<Task> {
  const nowIso = new Date().toISOString()
  return updateTask(
    task.id,
    {
      status: 'done',
      completedAt: nowIso,
      previousUpdatedAt: task.updatedAt,
    },
    task
  )
}

export async function reopenTask(task: Task): Promise<Task> {
  return updateTask(
    task.id,
    {
      status: 'todo',
      completedAt: null,
      previousUpdatedAt: task.updatedAt,
    },
    task
  )
}

export async function getTasksByIds(ids: string[]): Promise<Task[]> {
  if (!ids || ids.length === 0) return []
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .in('id', ids)

  if (error) {
    throw new Error(error.message)
  }

  return ((data as TaskRow[]) || []).map(rowToTask)
}

export async function getCategoryRelatedTasks(categoryId: string, excludeTaskId: string): Promise<Task[]> {
  if (!categoryId) return []
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('category_id', categoryId)
    .neq('id', excludeTaskId)
    .neq('status', 'done')
    .limit(5)

  if (error) {
    throw new Error(error.message)
  }

  return ((data as TaskRow[]) || []).map(rowToTask)
}

export async function getSiblingTasks(parentId: string, currentTaskId: string): Promise<Task[]> {
  if (!parentId) return []
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('parent_id', parentId)
    .neq('id', currentTaskId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return ((data as TaskRow[]) || []).map(rowToTask)
}

export async function searchTasksCandidate(queryStr: string, currentTaskId: string): Promise<Task[]> {
  let query = supabase
    .from('tasks')
    .select('*')
    .neq('id', currentTaskId)
    .limit(10)

  if (queryStr.trim()) {
    query = query.ilike('title', `%${queryStr.trim()}%`)
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const { data, error } = await query
  if (error) return []
  return ((data as TaskRow[]) || []).map(rowToTask)
}

export async function getSchedulableTasks(limit = 100): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return ((data as TaskRow[]) || []).map(rowToTask)
}

