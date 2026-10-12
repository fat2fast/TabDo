import { getLocalDayBoundaries } from '@tabdo/utils'
import { completeTaskAndGenerateNext } from '@tabdo/supabase'
import type { CompleteTaskAndGenerateNextResult, TaskAttachment } from '@tabdo/types'
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
import {
  extractTaskAttachments,
  mergeTaskAttachments,
} from '../utils/task-attachments'

export async function getTaskList(input: TaskListQueryInput): Promise<Task[]> {
  let query = supabase.from('tasks').select('*')

  // Explicit active vs trash projection
  if (typeof (query as any).is === 'function') {
    if (input.view === 'trash') {
      if (typeof (query as any).not === 'function') {
        query = query.not('deleted_at', 'is', null)
      }
    } else {
      query = query.is('deleted_at', null)
    }
  }

  // Apply smart view predicates
  switch (input.view) {
    case 'inbox': {
      // 'All Tasks' view: displays all tasks without restricting due_at or excluding completed tasks.
      // Active tasks will be sorted first, and completed tasks pushed to the bottom.
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
    case 'trash': {
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
  if (input.completedFrom) {
    query = query.gte('completed_at', input.completedFrom)
  }
  if (input.completedTo) {
    query = query.lte('completed_at', input.completedTo)
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

  const tasks = ((data as TaskRow[]) || []).map(rowToTask)

  if (input.view === 'inbox' && !input.status) {
    const activeTasks = tasks.filter((t) => t.status !== 'done')
    const completedTasks = tasks.filter((t) => t.status === 'done')
    return [...activeTasks, ...completedTasks]
  }

  return tasks
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

export async function getSubtasks(parentId: string, includeDeleted = false): Promise<Task[]> {
  let query = supabase
    .from('tasks')
    .select('*')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: true })

  if (!includeDeleted && typeof (query as any).is === 'function') {
    query = query.is('deleted_at', null)
  }

  const { data, error } = await query

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
    recurrence_rule: input.recurrenceRule || null,
    recurrence_series_id: input.recurrenceSeriesId || null,
    recurrence_parent_id: input.recurrenceParentId || null,
    recurrence_timezone: input.recurrenceTimezone || null,
    recurrence_anchor_at: input.recurrenceAnchorAt || null,
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

  if (task.recurrenceRule) {
    await recordTaskActivity({
      userId: session.user.id,
      taskId: task.id,
      action: 'recurrence_enabled',
      metadata: { rule: task.recurrenceRule },
    })
  }

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
  if (input.recurrenceRule !== undefined) updates.recurrence_rule = input.recurrenceRule || null
  if (input.recurrenceSeriesId !== undefined) updates.recurrence_series_id = input.recurrenceSeriesId || null
  if (input.recurrenceParentId !== undefined) updates.recurrence_parent_id = input.recurrenceParentId || null
  if (input.recurrenceTimezone !== undefined) updates.recurrence_timezone = input.recurrenceTimezone || null
  if (input.recurrenceAnchorAt !== undefined) updates.recurrence_anchor_at = input.recurrenceAnchorAt || null

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }

  // Prevent reopening a completed recurring task if a successor occurrence has already been spawned
  if (previousTask && previousTask.status === 'done' && input.status && input.status !== 'done') {
    const { data: successor, error: checkError } = await supabase
      .from('tasks')
      .select('id')
      .eq('recurrence_parent_id', id)
      .maybeSingle()

    if (checkError) {
      throw new Error(checkError.message)
    }

    if (successor) {
      throw new Error('Không thể mở lại công việc lặp lại đã có phiên lặp tiếp theo')
    }
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
    } else if (!previousTask.recurrenceRule && task.recurrenceRule) {
      await recordTaskActivity({
        userId: session.user.id,
        taskId: task.id,
        action: 'recurrence_enabled',
        metadata: { rule: task.recurrenceRule },
      })
    } else if (previousTask.recurrenceRule && !task.recurrenceRule) {
      await recordTaskActivity({
        userId: session.user.id,
        taskId: task.id,
        action: 'recurrence_disabled',
      })
    } else if (
      previousTask.recurrenceRule &&
      task.recurrenceRule &&
      previousTask.recurrenceRule !== task.recurrenceRule
    ) {
      await recordTaskActivity({
        userId: session.user.id,
        taskId: task.id,
        action: 'recurrence_changed',
        metadata: { from: previousTask.recurrenceRule, to: task.recurrenceRule },
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
  const { error } = await supabase.rpc('trash_task', { p_task_id: id })
  if (error) {
    throw new Error(error.message)
  }
}

export async function trashTask(id: string): Promise<void> {
  return deleteTask(id)
}

export async function restoreTask(id: string): Promise<void> {
  const { error } = await supabase.rpc('restore_task', { p_task_id: id })
  if (error) {
    throw new Error(error.message)
  }
}

export async function purgeTask(id: string): Promise<void> {
  const { error } = await supabase.rpc('request_purge_task', { p_task_id: id })
  if (error) {
    throw new Error(error.message)
  }
}

export async function getTrashTasks(search?: string): Promise<Task[]> {
  let query = supabase
    .from('tasks')
    .select('*')
    .not('deleted_at', 'is', null)
    .is('purge_status', null)
    .order('deleted_at', { ascending: false })

  if (search && search.trim()) {
    query = query.ilike('title', `%${search.trim()}%`)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  return ((data as TaskRow[]) || []).map(rowToTask)
}

export async function completeTask(task: Task): Promise<CompleteTaskAndGenerateNextResult> {
  // The atomic RPC already inserts 'completed' and 'next_occurrence_generated' activities
  // inside the transaction. Do NOT write them again here to avoid duplicate audit records.
  return completeTaskAndGenerateNext(supabase, task.id, task.updatedAt)
}

export async function reopenTask(task: Task): Promise<Task> {
  // Check if there is already a generated successor
  const { data: successor, error: checkError } = await supabase
    .from('tasks')
    .select('id')
    .eq('recurrence_parent_id', task.id)
    .maybeSingle()

  if (checkError) {
    throw new Error(checkError.message)
  }

  if (successor) {
    throw new Error('Không thể mở lại công việc lặp lại đã có phiên lặp tiếp theo')
  }

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
  let q = supabase
    .from('tasks')
    .select('*')

  if (typeof (q as any).is === 'function') {
    q = q.is('deleted_at', null)
  }

  const { data, error } = await q.in('id', ids)

  if (error) {
    throw new Error(error.message)
  }

  return ((data as TaskRow[]) || []).map(rowToTask)
}

export async function getCategoryRelatedTasks(categoryId: string, excludeTaskId: string): Promise<Task[]> {
  if (!categoryId) return []
  let q = supabase
    .from('tasks')
    .select('*')

  if (typeof (q as any).is === 'function') {
    q = q.is('deleted_at', null)
  }

  const { data, error } = await q
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
  let q = supabase
    .from('tasks')
    .select('*')

  if (typeof (q as any).is === 'function') {
    q = q.is('deleted_at', null)
  }

  const { data, error } = await q
    .eq('parent_id', parentId)
    .neq('id', currentTaskId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return ((data as TaskRow[]) || []).map(rowToTask)
}

export async function searchTasksCandidate(queryStr: string, currentTaskId?: string): Promise<Task[]> {
  let query = supabase
    .from('tasks')
    .select('*')

  if (typeof (query as any).is === 'function') {
    query = query.is('deleted_at', null)
  }

  query = query.limit(10)

  if (currentTaskId) {
    query = query.neq('id', currentTaskId)
  }

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
  let q = supabase
    .from('tasks')
    .select('*')

  if (typeof (q as any).is === 'function') {
    q = q.is('deleted_at', null)
  }

  const { data, error } = await q
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return ((data as TaskRow[]) || []).map(rowToTask)
}

export interface TaskAttachmentRow {
  id: string
  user_id: string
  task_id: string
  bucket: string
  object_path: string | null
  file_name: string
  mime_type: string | null
  byte_size: number | null
  kind: 'file' | 'link'
  external_url: string | null
  checksum: string | null
  upload_status: 'pending' | 'ready' | 'failed'
  created_at: string
  updated_at: string
}

function rowToAttachment(row: TaskAttachmentRow): TaskAttachment {
  return {
    id: row.id,
    userId: row.user_id,
    taskId: row.task_id,
    name: row.file_name,
    size: row.byte_size || 0,
    type:
      row.mime_type ||
      (row.kind === 'link' ? 'link' : 'application/octet-stream'),
    url: row.external_url || undefined,
    kind: row.kind,
    bucket: row.bucket,
    objectPath: row.object_path,
    externalUrl: row.external_url,
    checksum: row.checksum,
    uploadStatus: row.upload_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getTaskAttachments(
  taskId: string,
  legacyDescription?: string | null
): Promise<TaskAttachment[]> {
  const { data, error } = await supabase
    .from('task_attachments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })

  if (error) {
    console.warn('[getTaskAttachments] error reading attachments:', error.message)
  }

  const normalized = ((data as TaskAttachmentRow[]) || []).map(rowToAttachment)
  const legacy = extractTaskAttachments(legacyDescription)
  return mergeTaskAttachments(normalized, legacy)
}

export async function uploadTaskAttachment(
  taskId: string,
  file: File
): Promise<TaskAttachment> {
  const maxBytes = 10 * 1024 * 1024 // 10MB
  if (file.size > maxBytes) {
    throw new Error('Tệp vượt quá kích thước cho phép (tối đa 10MB).')
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) {
    throw new Error('Chưa đăng nhập.')
  }

  const attachmentId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `att-${Date.now()}`
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const objectPath = `${userId}/${taskId}/${attachmentId}_${sanitizedName}`

  // 1. Upload to Storage bucket
  const { error: uploadError } = await supabase.storage
    .from('task-attachments')
    .upload(objectPath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Tải tệp lên thất bại: ${uploadError.message}`)
  }

  // 2. Insert metadata row
  const { data, error: insertError } = await supabase
    .from('task_attachments')
    .insert({
      id: attachmentId,
      task_id: taskId,
      user_id: userId,
      bucket: 'task-attachments',
      object_path: objectPath,
      file_name: file.name,
      mime_type: file.type || 'application/octet-stream',
      byte_size: file.size,
      kind: 'file',
      upload_status: 'ready',
    })
    .select()
    .single()

  if (insertError) {
    // Attempt rollback of storage object if metadata insert fails
    await supabase.storage.from('task-attachments').remove([objectPath])
    throw new Error(`Lưu thông tin tệp thất bại: ${insertError.message}`)
  }

  return rowToAttachment(data as TaskAttachmentRow)
}

export async function createTaskLinkAttachment(
  taskId: string,
  name: string,
  url: string
): Promise<TaskAttachment> {
  const trimmedUrl = url.trim()
  if (!/^https?:\/\//i.test(trimmedUrl)) {
    throw new Error('Liên kết phải bắt đầu bằng http:// hoặc https://')
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) {
    throw new Error('Chưa đăng nhập.')
  }

  const { data, error } = await supabase
    .from('task_attachments')
    .insert({
      task_id: taskId,
      user_id: userId,
      bucket: 'task-attachments',
      object_path: null,
      file_name: name.trim() || trimmedUrl,
      mime_type: 'link',
      byte_size: null,
      kind: 'link',
      external_url: trimmedUrl,
      upload_status: 'ready',
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Thêm liên kết thất bại: ${error.message}`)
  }

  return rowToAttachment(data as TaskAttachmentRow)
}

export async function deleteTaskAttachment(
  attachment: TaskAttachment
): Promise<void> {
  // If storage object exists, remove it
  if (attachment.kind === 'file' && attachment.objectPath) {
    const { error: storageError } = await supabase.storage
      .from(attachment.bucket || 'task-attachments')
      .remove([attachment.objectPath])
    if (storageError) {
      console.warn('[deleteTaskAttachment] storage remove error:', storageError.message)
    }
  }

  // Remove database metadata row
  if (attachment.id) {
    const { error: dbError } = await supabase
      .from('task_attachments')
      .delete()
      .eq('id', attachment.id)
    if (dbError) {
      console.warn('[deleteTaskAttachment] db delete error:', dbError.message)
    }
  }
}

export async function downloadTaskAttachment(
  attachment: TaskAttachment
): Promise<{ blob: Blob; fileName: string }> {
  if (attachment.objectPath) {
    const { data, error } = await supabase.storage
      .from(attachment.bucket || 'task-attachments')
      .download(attachment.objectPath)

    if (error || !data) {
      throw new Error(`Tải xuống thất bại: ${error?.message || 'Không tìm thấy tệp'}`)
    }
    return { blob: data, fileName: attachment.name }
  }

  if (attachment.url) {
    const res = await fetch(attachment.url)
    const blob = await res.blob()
    return { blob, fileName: attachment.name }
  }

  throw new Error('Không có đường dẫn tệp để tải xuống.')
}

export async function downloadAndOpenAttachment(
  attachment: TaskAttachment
): Promise<void> {
  if (attachment.kind === 'link' || attachment.type === 'link') {
    const targetUrl = attachment.externalUrl || attachment.url
    if (targetUrl) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer')
    }
    return
  }

  const { blob, fileName } = await downloadTaskAttachment(attachment)
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}
