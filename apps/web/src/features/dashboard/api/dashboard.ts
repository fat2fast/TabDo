import type { SupabaseClient } from '@supabase/supabase-js'
import { getVisibleRangeForDay, getVisibleRangeForNextDays } from '@tabdo/utils'
import { supabase as defaultClient } from '../../../lib/supabase'
import { type Task, type TaskRow, rowToTask } from '../../tasks/types'
import { type ScheduleBlock, type ScheduleBlockRow, toScheduleBlock } from '../../scheduling/types'
import type { DashboardSnapshot, TodayScheduleItem } from '../types'
import { deriveDashboardSnapshot } from '../utils/dashboard-metrics'

export interface FetchDashboardSnapshotOptions {
  client?: SupabaseClient
  timeZone: string
  now?: Date
}

export async function fetchDashboardSnapshot(
  options: FetchDashboardSnapshotOptions
): Promise<DashboardSnapshot> {
  const client = options.client ?? defaultClient
  const now = options.now ?? new Date()
  const timeZone = options.timeZone

  const { startAt: localStartIso, endAt: nextLocalStartIso } = getVisibleRangeForDay(now, timeZone)
  const { endAt: nextSevenDaysEndIso } = getVisibleRangeForNextDays(now, timeZone, 7)

  // 1. Incomplete tasks projection (active only)
  let incompleteQuery = client
    .from('tasks')
    .select('*')

  if (typeof (incompleteQuery as any).is === 'function') {
    incompleteQuery = incompleteQuery.is('deleted_at', null)
  }

  const incompleteTasksPromise = incompleteQuery
    .neq('status', 'done')
    .order('priority_rank', { ascending: false })

  // 2. Tasks completed in local today [localStartIso, nextLocalStartIso)
  let completedTodayQuery = client
    .from('tasks')
    .select('*')

  if (typeof (completedTodayQuery as any).is === 'function') {
    completedTodayQuery = completedTodayQuery.is('deleted_at', null)
  }

  const completedTodayTasksPromise = completedTodayQuery
    .eq('status', 'done')
    .gte('completed_at', localStartIso)
    .lt('completed_at', nextLocalStartIso)
    .order('completed_at', { ascending: false })

  // 3. Schedule blocks overlapping local today [localStartIso, nextLocalStartIso) with joined task projection
  const todayBlocksPromise = client
    .from('schedule_blocks')
    .select('*, tasks(*)')
    .lt('start_at', nextLocalStartIso)
    .gt('end_at', localStartIso)
    .order('start_at', { ascending: true })

  // 4. In-progress tasks projection (top 5 with exact total count)
  let inProgressQuery = client
    .from('tasks')
    .select('*', { count: 'exact' })

  if (typeof (inProgressQuery as any).is === 'function') {
    inProgressQuery = inProgressQuery.is('deleted_at', null)
  }

  const inProgressPromise = inProgressQuery
    .eq('status', 'in_progress')
    .order('updated_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(5)

  const [incompleteRes, completedRes, blocksRes, inProgressRes] = await Promise.all([
    incompleteTasksPromise,
    completedTodayTasksPromise,
    todayBlocksPromise,
    inProgressPromise,
  ])

  if (incompleteRes.error) {
    throw new Error(incompleteRes.error.message)
  }
  if (completedRes.error) {
    throw new Error(completedRes.error.message)
  }
  if (blocksRes.error) {
    throw new Error(blocksRes.error.message)
  }
  if (inProgressRes.error) {
    throw new Error(inProgressRes.error.message)
  }

  const incompleteTasks: Task[] = ((incompleteRes.data as TaskRow[]) || []).map(rowToTask)
  const completedTodayTasks: Task[] = ((completedRes.data as TaskRow[]) || []).map(rowToTask)
  const inProgressTasks: Task[] = ((inProgressRes.data as TaskRow[]) || []).map(rowToTask)
  const inProgressTotal = inProgressRes.count ?? inProgressTasks.length

  interface RawBlockWithTask extends ScheduleBlockRow {
    tasks: TaskRow | null
  }

  const todayBlocks: (ScheduleBlock & { task?: Task | null })[] = (
    (blocksRes.data as unknown as RawBlockWithTask[]) || []
  ).map((row) => {
    const block = toScheduleBlock(row)
    return {
      ...block,
      task: row.tasks && !row.tasks.deleted_at ? rowToTask(row.tasks) : null,
    }
  })

  return deriveDashboardSnapshot({
    incompleteTasks,
    completedTodayTasks,
    todayBlocks,
    inProgressTasks,
    inProgressTotal,
    referenceNow: now,
    localStartIso,
    nextLocalStartIso,
    nextSevenDaysEndIso,
  })
}

export interface PagedResult<T> {
  items: T[]
  total: number
  hasMore: boolean
}

export interface PagedQueryOptions {
  page?: number
  pageSize?: number
  client?: SupabaseClient
}

/**
 * Fetch paged In-Progress tasks on demand when scrolling.
 */
export async function fetchInProgressTasksPaged(
  options: PagedQueryOptions = {}
): Promise<PagedResult<Task>> {
  const client = options.client ?? defaultClient
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.max(1, options.pageSize ?? 5)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = client.from('tasks').select('*', { count: 'exact' })
  if (typeof (query as any).is === 'function') {
    query = query.is('deleted_at', null)
  }

  const res = await query
    .eq('status', 'in_progress')
    .order('updated_at', { ascending: false })
    .order('id', { ascending: true })
    .range(from, to)

  if (res.error) {
    throw new Error(res.error.message)
  }

  const items = ((res.data as TaskRow[]) || []).map(rowToTask)
  const total = res.count ?? items.length
  return {
    items,
    total,
    hasMore: from + items.length < total,
  }
}

export interface PriorityPagedQueryOptions extends PagedQueryOptions {
  timeZone?: string
  now?: Date
}

/**
 * Fetch paged Priority tasks on demand when scrolling.
 */
export async function fetchPriorityTasksPaged(
  options: PriorityPagedQueryOptions = {}
): Promise<PagedResult<Task>> {
  const client = options.client ?? defaultClient
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.max(1, options.pageSize ?? 5)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = client.from('tasks').select('*', { count: 'exact' })
  if (typeof (query as any).is === 'function') {
    query = query.is('deleted_at', null)
  }

  const res = await query
    .neq('status', 'done')
    .order('priority_rank', { ascending: false })
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
    .range(from, to)

  if (res.error) {
    throw new Error(res.error.message)
  }

  const items = ((res.data as TaskRow[]) || []).map(rowToTask)
  const total = res.count ?? items.length
  return {
    items,
    total,
    hasMore: from + items.length < total,
  }
}

export interface SchedulePagedQueryOptions extends PagedQueryOptions {
  timeZone: string
  now?: Date
}

/**
 * Fetch paged Today Schedule items on demand when scrolling.
 */
export async function fetchTodaySchedulePaged(
  options: SchedulePagedQueryOptions
): Promise<PagedResult<TodayScheduleItem>> {
  const client = options.client ?? defaultClient
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.max(1, options.pageSize ?? 5)
  const timeZone = options.timeZone
  const now = options.now ?? new Date()
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { startAt: localStartIso, endAt: nextLocalStartIso } = getVisibleRangeForDay(now, timeZone)

  const res = await client
    .from('schedule_blocks')
    .select('*, tasks(*)', { count: 'exact' })
    .lt('start_at', nextLocalStartIso)
    .gt('end_at', localStartIso)
    .order('start_at', { ascending: true })
    .range(from, to)

  if (res.error) {
    throw new Error(res.error.message)
  }

  interface RawBlockWithTask extends ScheduleBlockRow {
    tasks: TaskRow | null
  }

  const items: TodayScheduleItem[] = ((res.data as unknown as RawBlockWithTask[]) || []).map((row) => {
    const block = toScheduleBlock(row)
    const task = row.tasks && !row.tasks.deleted_at ? rowToTask(row.tasks) : null
    return {
      id: block.id,
      title: block.title,
      startAt: block.startAt,
      endAt: block.endAt,
      taskId: block.taskId ?? null,
      taskTitle: task?.title ?? null,
      taskStatus: task?.status ?? null,
      taskPriority: task?.priority ?? null,
    }
  })

  const total = res.count ?? items.length
  return {
    items,
    total,
    hasMore: from + items.length < total,
  }
}

export interface UpcomingPagedQueryOptions extends PagedQueryOptions {
  timeZone: string
  now?: Date
}

/**
 * Fetch paged Upcoming Deadlines tasks on demand when scrolling.
 */
export async function fetchUpcomingDeadlinesPaged(
  options: UpcomingPagedQueryOptions
): Promise<PagedResult<Task>> {
  const client = options.client ?? defaultClient
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.max(1, options.pageSize ?? 5)
  const timeZone = options.timeZone
  const now = options.now ?? new Date()
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { endAt: nextLocalStartIso } = getVisibleRangeForDay(now, timeZone)
  const { endAt: nextSevenDaysEndIso } = getVisibleRangeForNextDays(now, timeZone, 7)

  let query = client.from('tasks').select('*', { count: 'exact' })
  if (typeof (query as any).is === 'function') {
    query = query.is('deleted_at', null)
  }

  const res = await query
    .neq('status', 'done')
    .gte('due_at', nextLocalStartIso)
    .lt('due_at', nextSevenDaysEndIso)
    .order('due_at', { ascending: true })
    .order('id', { ascending: true })
    .range(from, to)

  if (res.error) {
    throw new Error(res.error.message)
  }

  const items = ((res.data as TaskRow[]) || []).map(rowToTask)
  const total = res.count ?? items.length
  return {
    items,
    total,
    hasMore: from + items.length < total,
  }
}
