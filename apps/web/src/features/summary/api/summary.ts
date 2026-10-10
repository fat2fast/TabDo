import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getSummaryRangeForDay,
  getSummaryRangeForWeek,
  parseLocalDateReference,
} from '@tabdo/utils'
import { addDays } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { supabase as defaultClient } from '../../../lib/supabase'
import {
  type Category,
  type CategoryRow,
  type Task,
  type TaskRow,
  rowToCategory,
  rowToTask,
} from '../../tasks/types'
import {
  type ScheduleBlock,
  type ScheduleBlockRow,
  toScheduleBlock,
} from '../../scheduling/types'
import type {
  DeriveSummaryInput,
  PreviousWeekMetrics,
  SummaryData,
  SummaryPeriod,
  TaskActivitySummaryItem,
} from '../types'
import { deriveSummary } from '../utils/summary-metrics'

const PAGE_SIZE = 500

interface RawBlockWithTask extends ScheduleBlockRow {
  tasks: TaskRow | null
}

interface RawActivityRow {
  id: string
  task_id: string
  action: string
  created_at: string
}

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const all: T[] = []
  let from = 0

  while (true) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await fetchPage(from, to)

    if (error) {
      const message = error instanceof Error ? error.message : (error as { message?: string })?.message || 'Database query failed'
      throw new Error(message)
    }

    const rows = data || []
    all.push(...rows)

    if (rows.length < PAGE_SIZE) {
      break
    }
    from += PAGE_SIZE
  }

  return all
}

export interface FetchSummaryOptions {
  client?: SupabaseClient
  period: SummaryPeriod
  selectedDateStr: string // YYYY-MM-DD
  timeZone: string
  now?: Date
}

export async function fetchSummaryData(
  options: FetchSummaryOptions
): Promise<SummaryData> {
  const client = options.client ?? defaultClient
  const now = options.now ?? new Date()
  const { period, selectedDateStr, timeZone } = options

  // 1. Calculate half-open bounds
  const { startAt, endAt } =
    period === 'weekly'
      ? getSummaryRangeForWeek(selectedDateStr, timeZone)
      : getSummaryRangeForDay(selectedDateStr, timeZone)

  const startTime = new Date(startAt).getTime()
  const endTime = new Date(endAt).getTime()
  const nowTime = now.getTime()
  const isCurrentPeriod = nowTime >= startTime && nowTime < endTime
  const cutoffAt = isCurrentPeriod ? now.toISOString() : endAt

  // 2. Concurrently fetch bounded pages for primary datasets
  const tasksDuePromise = fetchAllPages<TaskRow>((from, to) =>
    client
      .from('tasks')
      .select('*')
      .gte('due_at', startAt)
      .lt('due_at', endAt)
      .range(from, to)
  )

  const tasksCompletedPromise = fetchAllPages<TaskRow>((from, to) =>
    client
      .from('tasks')
      .select('*')
      .gte('completed_at', startAt)
      .lt('completed_at', endAt)
      .range(from, to)
  )

  const scheduleBlocksPromise = fetchAllPages<RawBlockWithTask>((from, to) =>
    client
      .from('schedule_blocks')
      .select('*, tasks(*)')
      .lt('start_at', endAt)
      .gt('end_at', startAt)
      .range(from, to)
  )

  const activitiesPromise = fetchAllPages<RawActivityRow>((from, to) =>
    client
      .from('task_activities')
      .select('id, task_id, action, created_at')
      .eq('action', 'completed')
      .gte('created_at', startAt)
      .lt('created_at', endAt)
      .range(from, to)
  )

  const incompleteCutoffTasksPromise = fetchAllPages<TaskRow>((from, to) =>
    client
      .from('tasks')
      .select('*')
      .neq('status', 'done')
      .lt('due_at', cutoffAt)
      .lt('created_at', cutoffAt)
      .range(from, to)
  )

  const categoriesPromise = fetchAllPages<CategoryRow>((from, to) =>
    client
      .from('categories')
      .select('*')
      .range(from, to)
  )

  const [
    tasksDueRows,
    tasksCompletedRows,
    blockRows,
    activityRows,
    incompleteCutoffRows,
    categoryRows,
  ] = await Promise.all([
    tasksDuePromise,
    tasksCompletedPromise,
    scheduleBlocksPromise,
    activitiesPromise,
    incompleteCutoffTasksPromise,
    categoriesPromise,
  ])

  const tasksDueInPeriod: Task[] = tasksDueRows.map(rowToTask)
  const tasksCompletedInPeriod: Task[] = tasksCompletedRows.map(rowToTask)
  const scheduleBlocksInPeriod: (ScheduleBlock & { task?: Task | null })[] =
    blockRows.map((r) => ({
      ...toScheduleBlock(r),
      task: r.tasks ? rowToTask(r.tasks) : null,
    }))
  const completedActivitiesInPeriod: TaskActivitySummaryItem[] = activityRows.map(
    (a) => ({
      id: a.id,
      taskId: a.task_id,
      action: a.action,
      createdAt: a.created_at,
    })
  )
  const incompleteCutoffTasks: Task[] = incompleteCutoffRows.map(rowToTask)
  const categories: Category[] = categoryRows.map(rowToCategory)

  // 3. Resolve surviving activity tasks not already fetched
  const knownTaskIds = new Set<string>([
    ...tasksDueInPeriod.map((t) => t.id),
    ...tasksCompletedInPeriod.map((t) => t.id),
    ...scheduleBlocksInPeriod
      .map((b) => b.task?.id)
      .filter((id): id is string => Boolean(id)),
    ...incompleteCutoffTasks.map((t) => t.id),
  ])

  const missingActivityTaskIds = Array.from(
    new Set(
      completedActivitiesInPeriod
        .map((a) => a.taskId)
        .filter((id) => !knownTaskIds.has(id))
    )
  )

  const survivingActivityTasks: Task[] = []
  if (missingActivityTaskIds.length > 0) {
    const CHUNK_SIZE = 100
    for (let i = 0; i < missingActivityTaskIds.length; i += CHUNK_SIZE) {
      const chunk = missingActivityTaskIds.slice(i, i + CHUNK_SIZE)
      const { data, error } = await client
        .from('tasks')
        .select('*')
        .in('id', chunk)

      if (error) {
        throw new Error(error.message)
      }
      if (data) {
        survivingActivityTasks.push(...(data as TaskRow[]).map(rowToTask))
      }
    }
  }

  // 4. If weekly, fetch previous week data to compute previousWeekMetrics
  let previousWeekMetrics: PreviousWeekMetrics | null = null
  if (period === 'weekly') {
    const currentRef = parseLocalDateReference(selectedDateStr, timeZone)
    const prevRef = addDays(currentRef, -7)
    const prevDateStr = formatInTimeZone(prevRef, timeZone, 'yyyy-MM-dd')
    const { startAt: prevStartAt, endAt: prevEndAt } = getSummaryRangeForWeek(
      prevDateStr,
      timeZone
    )

    const prevTasksDuePromise = fetchAllPages<TaskRow>((from, to) =>
      client
        .from('tasks')
        .select('*')
        .gte('due_at', prevStartAt)
        .lt('due_at', prevEndAt)
        .range(from, to)
    )

    const prevTasksCompletedPromise = fetchAllPages<TaskRow>((from, to) =>
      client
        .from('tasks')
        .select('*')
        .gte('completed_at', prevStartAt)
        .lt('completed_at', prevEndAt)
        .range(from, to)
    )

    const prevScheduleBlocksPromise = fetchAllPages<RawBlockWithTask>((from, to) =>
      client
        .from('schedule_blocks')
        .select('*, tasks(*)')
        .lt('start_at', prevEndAt)
        .gt('end_at', prevStartAt)
        .range(from, to)
    )

    const prevActivitiesPromise = fetchAllPages<RawActivityRow>((from, to) =>
      client
        .from('task_activities')
        .select('id, task_id, action, created_at')
        .eq('action', 'completed')
        .gte('created_at', prevStartAt)
        .lt('created_at', prevEndAt)
        .range(from, to)
    )

    const [prevDueRows, prevCompletedRows, prevBlockRows, prevActRows] =
      await Promise.all([
        prevTasksDuePromise,
        prevTasksCompletedPromise,
        prevScheduleBlocksPromise,
        prevActivitiesPromise,
      ])

    const prevDueTasks = prevDueRows.map(rowToTask)
    const prevCompletedTasks = prevCompletedRows.map(rowToTask)
    const prevBlocks = prevBlockRows.map((r) => ({
      ...toScheduleBlock(r),
      task: r.tasks ? rowToTask(r.tasks) : null,
    }))
    const prevActivities = prevActRows.map((a) => ({
      id: a.id,
      taskId: a.task_id,
      action: a.action,
      createdAt: a.created_at,
    }))

    const prevKnownIds = new Set<string>([
      ...prevDueTasks.map((t) => t.id),
      ...prevCompletedTasks.map((t) => t.id),
    ])
    const prevMissingIds = Array.from(
      new Set(
        prevActivities
          .map((a) => a.taskId)
          .filter((id) => !prevKnownIds.has(id))
      )
    )
    const prevSurvivingTasks: Task[] = []
    if (prevMissingIds.length > 0) {
      const { data, error } = await client
        .from('tasks')
        .select('*')
        .in('id', prevMissingIds)
      if (error) {
        throw new Error(error.message)
      }
      if (data) {
        prevSurvivingTasks.push(...(data as TaskRow[]).map(rowToTask))
      }
    }

    const prevSummary = deriveSummary({
      period: 'weekly',
      selectedDateStr: prevDateStr,
      timeZone,
      referenceNow: now,
      tasksDueInPeriod: prevDueTasks,
      tasksCompletedInPeriod: prevCompletedTasks,
      scheduleBlocksInPeriod: prevBlocks,
      completedActivitiesInPeriod: prevActivities,
      survivingActivityTasks: prevSurvivingTasks,
      incompleteCutoffTasks: [],
      categories,
    })

    previousWeekMetrics = {
      plannedCount: prevSummary.plannedCount,
      completedCount: prevSummary.completedCount,
      completedPlannedCount: prevSummary.completedPlannedCount,
      completionRate: prevSummary.completionRate,
    }
  }

  // 5. Derive pure summary result
  const deriveInput: DeriveSummaryInput = {
    period,
    selectedDateStr,
    timeZone,
    referenceNow: now,
    tasksDueInPeriod,
    tasksCompletedInPeriod,
    scheduleBlocksInPeriod,
    completedActivitiesInPeriod,
    survivingActivityTasks,
    incompleteCutoffTasks,
    categories,
    previousWeekMetrics,
  }

  return deriveSummary(deriveInput)
}
