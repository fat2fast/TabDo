import type { SupabaseClient } from '@supabase/supabase-js'
import { getVisibleRangeForDay, getVisibleRangeForNextDays } from '@tabdo/utils'
import { supabase as defaultClient } from '../../../lib/supabase'
import { type Task, type TaskRow, rowToTask } from '../../tasks/types'
import { type ScheduleBlock, type ScheduleBlockRow, toScheduleBlock } from '../../scheduling/types'
import type { DashboardSnapshot } from '../types'
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

  // 1. Incomplete tasks projection
  const incompleteTasksPromise = client
    .from('tasks')
    .select('*')
    .neq('status', 'done')
    .order('priority_rank', { ascending: false })

  // 2. Tasks completed in local today [localStartIso, nextLocalStartIso)
  const completedTodayTasksPromise = client
    .from('tasks')
    .select('*')
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

  const [incompleteRes, completedRes, blocksRes] = await Promise.all([
    incompleteTasksPromise,
    completedTodayTasksPromise,
    todayBlocksPromise,
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

  const incompleteTasks: Task[] = ((incompleteRes.data as TaskRow[]) || []).map(rowToTask)
  const completedTodayTasks: Task[] = ((completedRes.data as TaskRow[]) || []).map(rowToTask)

  interface RawBlockWithTask extends ScheduleBlockRow {
    tasks: TaskRow | null
  }

  const todayBlocks: (ScheduleBlock & { task?: Task | null })[] = (
    (blocksRes.data as unknown as RawBlockWithTask[]) || []
  ).map((row) => {
    const block = toScheduleBlock(row)
    return {
      ...block,
      task: row.tasks ? rowToTask(row.tasks) : null,
    }
  })

  return deriveDashboardSnapshot({
    incompleteTasks,
    completedTodayTasks,
    todayBlocks,
    referenceNow: now,
    localStartIso,
    nextLocalStartIso,
    nextSevenDaysEndIso,
  })
}
