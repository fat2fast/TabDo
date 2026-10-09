import type { Task, TaskPriority } from '../../tasks/types'
import type { ScheduleBlock } from '../../scheduling/types'
import type { DashboardMetrics, DashboardSnapshot, TodayScheduleItem } from '../types'

export interface DeriveDashboardSnapshotInput {
  incompleteTasks: Task[]
  completedTodayTasks: Task[]
  todayBlocks: (ScheduleBlock & { task?: Task | null })[]
  referenceNow: Date
  localStartIso: string
  nextLocalStartIso: string
  nextSevenDaysEndIso: string
}

function priorityToRank(priority: TaskPriority | undefined): number {
  switch (priority) {
    case 'high':
      return 3
    case 'medium':
      return 2
    case 'low':
      return 1
    default:
      return 2
  }
}

/** Parse an ISO timestamp string (any offset format) to epoch ms, returning NaN on null/undefined. */
function toMs(iso: string | null | undefined): number {
  if (!iso) return NaN
  return new Date(iso).getTime()
}

/**
 * Pure function deriving the dashboard snapshot and metrics.
 * Ensures tasks due and scheduled appear only once in calculations.
 * Relies on explicit timezone boundaries rather than Date.now().
 */
export function deriveDashboardSnapshot(input: DeriveDashboardSnapshotInput): DashboardSnapshot {
  const {
    incompleteTasks,
    completedTodayTasks,
    todayBlocks,
    referenceNow,
    localStartIso,
    nextLocalStartIso,
    nextSevenDaysEndIso,
  } = input

  const referenceNowMs = referenceNow.getTime()
  const localStartMs = toMs(localStartIso)
  const nextLocalStartMs = toMs(nextLocalStartIso)
  const nextSevenDaysEndMs = toMs(nextSevenDaysEndIso)

  // 1. Identify blocks overlapping the half-open local day [localStartMs, nextLocalStartMs)
  const overlappingBlocks = todayBlocks.filter(
    (b) => toMs(b.startAt) < nextLocalStartMs && toMs(b.endAt) > localStartMs
  )

  const scheduledTodayTaskIds = new Set<string>()
  for (const block of overlappingBlocks) {
    if (block.taskId) {
      scheduledTodayTaskIds.add(block.taskId)
    }
  }

  // 2. Build relevant-today tasks (deduplicated by task ID)
  // A task is relevant if:
  // - Incomplete and due before nextLocalStart (overdue + due today)
  // - Incomplete and scheduled in a block overlapping today
  // - Completed in [localStart, nextLocalStart) and meets either predicate above
  const relevantMap = new Map<string, Task>()

  for (const task of incompleteTasks) {
    const dueMs = toMs(task.dueAt)
    const isDueTodayOrOverdue = !isNaN(dueMs) && dueMs < nextLocalStartMs
    const isScheduledToday = scheduledTodayTaskIds.has(task.id)

    if (isDueTodayOrOverdue || isScheduledToday) {
      relevantMap.set(task.id, task)
    }
  }

  // Include tasks from blocks if they were not in incompleteTasks
  for (const block of overlappingBlocks) {
    if (block.task && !relevantMap.has(block.task.id)) {
      if (block.task.status !== 'done') {
        relevantMap.set(block.task.id, block.task)
      }
    }
  }

  for (const task of completedTodayTasks) {
    const completedMs = toMs(task.completedAt)
    const isCompletedInRange =
      !isNaN(completedMs) && completedMs >= localStartMs && completedMs < nextLocalStartMs

    if (!isCompletedInRange) continue

    const dueMs = toMs(task.dueAt)
    const wasDueTodayOrOverdue = !isNaN(dueMs) && dueMs < nextLocalStartMs
    const wasScheduledToday = scheduledTodayTaskIds.has(task.id)

    if (wasDueTodayOrOverdue || wasScheduledToday) {
      relevantMap.set(task.id, task)
    }
  }

  // Also include completed tasks attached to overlapping blocks if completed today
  for (const block of overlappingBlocks) {
    if (block.task && block.task.status === 'done' && !relevantMap.has(block.task.id)) {
      const completedMs = toMs(block.task.completedAt)
      const isCompletedInRange =
        !isNaN(completedMs) && completedMs >= localStartMs && completedMs < nextLocalStartMs
      if (isCompletedInRange) {
        relevantMap.set(block.task.id, block.task)
      }
    }
  }

  const relevantTasks = Array.from(relevantMap.values())
  const relevantCount = relevantTasks.length
  const completedCount = relevantTasks.filter((t) => t.status === 'done').length
  const remainingTasks = relevantTasks.filter((t) => t.status !== 'done')
  const remainingCount = remainingTasks.length

  // Incomplete tasks with due_at < now (epoch ms comparison)
  const overdueTasks = incompleteTasks
    .filter((t) => {
      const dueMs = toMs(t.dueAt)
      return t.status !== 'done' && !isNaN(dueMs) && dueMs < referenceNowMs
    })
    .sort((a, b) => toMs(a.dueAt) - toMs(b.dueAt))

  const overdueCount = overdueTasks.length

  const completionPercentage =
    relevantCount > 0 ? Math.round((completedCount / relevantCount) * 100) : 0

  const metrics: DashboardMetrics = {
    relevantCount,
    completedCount,
    remainingCount,
    overdueCount,
    completionPercentage,
  }

  // 3. Priority tasks: Top 3-5 incomplete relevant tasks (overdue first, high priority first, earliest due date first)
  const priorityTasks = [...remainingTasks]
    .sort((a, b) => {
      const aDueMs = toMs(a.dueAt)
      const bDueMs = toMs(b.dueAt)
      const aOverdue = !isNaN(aDueMs) && aDueMs < referenceNowMs ? 1 : 0
      const bOverdue = !isNaN(bDueMs) && bDueMs < referenceNowMs ? 1 : 0
      if (aOverdue !== bOverdue) return bOverdue - aOverdue

      const rankA = priorityToRank(a.priority)
      const rankB = priorityToRank(b.priority)
      if (rankA !== rankB) return rankB - rankA

      if (!isNaN(aDueMs) && !isNaN(bDueMs)) {
        const diff = aDueMs - bDueMs
        if (diff !== 0) return diff
      } else if (!isNaN(aDueMs) && isNaN(bDueMs)) {
        return -1
      } else if (isNaN(aDueMs) && !isNaN(bDueMs)) {
        return 1
      }

      return a.title.localeCompare(b.title)
    })
    .slice(0, 5)

  // 4. Upcoming deadlines: Incomplete tasks due in next 7 complete local days [nextLocalStart, nextSevenDaysEnd)
  const upcomingTasks = incompleteTasks
    .filter((t) => {
      const dueMs = toMs(t.dueAt)
      return (
        t.status !== 'done' &&
        !isNaN(dueMs) &&
        dueMs >= nextLocalStartMs &&
        dueMs < nextSevenDaysEndMs
      )
    })
    .sort((a, b) => toMs(a.dueAt) - toMs(b.dueAt))
    .slice(0, 5)

  // 5. Today's schedule items
  const todaySchedule: TodayScheduleItem[] = overlappingBlocks
    .sort((a, b) => toMs(a.startAt) - toMs(b.startAt))
    .map((b) => ({
      id: b.id,
      title: b.title,
      startAt: b.startAt,
      endAt: b.endAt,
      taskId: b.taskId ?? null,
      taskTitle: b.task?.title ?? null,
      taskStatus: b.task?.status ?? null,
      taskPriority: b.task?.priority ?? null,
    }))

  return {
    metrics,
    priorityTasks,
    overdueTasks,
    todaySchedule,
    upcomingTasks,
  }
}
