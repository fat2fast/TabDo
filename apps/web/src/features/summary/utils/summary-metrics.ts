import { addDays, startOfDay } from 'date-fns'
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz'
import {
  getSummaryRangeForDay,
  getSummaryRangeForWeek,
} from '@tabdo/utils'
import type { Task } from '@tabdo/types'
import type {
  CategorySummaryItem,
  DailySummary,
  DayCompletedBreakdown,
  DeriveSummaryInput,
  SummaryData,
  WeeklyComparison,
  WeeklySummary,
} from '../types'

const DAY_LABEL_KEYS = [
  'summary.dayMon',
  'summary.dayTue',
  'summary.dayWed',
  'summary.dayThu',
  'summary.dayFri',
  'summary.daySat',
  'summary.daySun',
]

/**
 * Pure derivation for daily and weekly summaries based on deterministic metric contract.
 */
export function deriveSummary(input: DeriveSummaryInput): SummaryData {
  const {
    period,
    selectedDateStr,
    timeZone,
    referenceNow,
    tasksDueInPeriod,
    tasksCompletedInPeriod,
    scheduleBlocksInPeriod,
    completedActivitiesInPeriod,
    survivingActivityTasks,
    incompleteCutoffTasks,
    categories,
    previousWeekMetrics,
  } = input

  // 1. Time range boundaries
  const { startAt, endAt } =
    period === 'weekly'
      ? getSummaryRangeForWeek(selectedDateStr, timeZone)
      : getSummaryRangeForDay(selectedDateStr, timeZone)

  const startTime = new Date(startAt).getTime()
  const endTime = new Date(endAt).getTime()
  const nowTime = referenceNow.getTime()

  const isCurrentPeriod = nowTime >= startTime && nowTime < endTime
  const cutoffAt = isCurrentPeriod ? referenceNow.toISOString() : endAt
  const cutoffTime = new Date(cutoffAt).getTime()

  // 2. Build task registry map to lookup task details
  const taskMap = new Map<string, Task>()
  const registerTask = (task: Task | null | undefined) => {
    if (task && !taskMap.has(task.id)) {
      taskMap.set(task.id, task)
    }
  }

  tasksDueInPeriod.forEach(registerTask)
  tasksCompletedInPeriod.forEach(registerTask)
  scheduleBlocksInPeriod.forEach((b) => registerTask(b.task))
  survivingActivityTasks.forEach(registerTask)
  incompleteCutoffTasks.forEach(registerTask)

  // 3. Planned Tasks:
  // Union of current tasks due in period [startAt, endAt) AND
  // task-linked schedule blocks overlapping [startAt, endAt) (start_at < endAt && end_at > startAt).
  const plannedIds = new Set<string>()

  for (const task of tasksDueInPeriod) {
    if (task.dueAt) {
      const dueTime = new Date(task.dueAt).getTime()
      if (dueTime >= startTime && dueTime < endTime) {
        plannedIds.add(task.id)
      }
    }
  }

  for (const block of scheduleBlocksInPeriod) {
    if (block.taskId) {
      const blockStartTime = new Date(block.startAt).getTime()
      const blockEndTime = new Date(block.endAt).getTime()
      if (blockStartTime < endTime && blockEndTime > startTime) {
        plannedIds.add(block.taskId)
      }
    }
  }

  const plannedCount = plannedIds.size

  // 4. Completed Output:
  // Union of tasks with completed_at in period [startAt, endAt) AND
  // surviving tasks with a 'completed' activity in period [startAt, endAt).
  const completedIds = new Set<string>()
  const completionInstants = new Map<string, string>()

  for (const task of tasksCompletedInPeriod) {
    if (task.completedAt) {
      const completedTime = new Date(task.completedAt).getTime()
      if (completedTime >= startTime && completedTime < endTime) {
        completedIds.add(task.id)
        completionInstants.set(task.id, task.completedAt)
      }
    }
  }

  for (const activity of completedActivitiesInPeriod) {
    if (activity.action === 'completed') {
      const actTime = new Date(activity.createdAt).getTime()
      if (actTime >= startTime && actTime < endTime) {
        if (taskMap.has(activity.taskId)) {
          completedIds.add(activity.taskId)
          if (!completionInstants.has(activity.taskId)) {
            completionInstants.set(activity.taskId, activity.createdAt)
          }
        }
      }
    }
  }

  const completedCount = completedIds.size
  const completedTasks: Task[] = []
  for (const id of completedIds) {
    const task = taskMap.get(id)
    if (task) {
      completedTasks.push(task)
    }
  }

  // Sort completed tasks by completion timestamp descending
  completedTasks.sort((a, b) => {
    const timeA = completionInstants.get(a.id) ?? a.completedAt ?? ''
    const timeB = completionInstants.get(b.id) ?? b.completedAt ?? ''
    return timeB.localeCompare(timeA)
  })

  // 5. Completion Rate:
  // Completed planned tasks ÷ planned tasks
  let completedPlannedCount = 0
  for (const id of plannedIds) {
    if (completedIds.has(id)) {
      completedPlannedCount++
    }
  }

  const completionRate =
    plannedCount === 0 ? null : Math.min(1, completedPlannedCount / plannedCount)

  // 6. Carry Over Tasks:
  // Incomplete relevant tasks: tasks that were planned for this period and whose current status is not 'done'.
  const carryOverTasks: Task[] = []
  for (const id of plannedIds) {
    const task = taskMap.get(id)
    if (task && task.status !== 'done') {
      carryOverTasks.push(task)
    }
  }
  const carryOverCount = carryOverTasks.length

  // 7. Overdue Tasks:
  // Incomplete work due before cutoff (now for current period; period end otherwise),
  // with created_at before cutoff.
  const overdueMap = new Map<string, Task>()
  for (const task of incompleteCutoffTasks) {
    if (task.status !== 'done' && task.dueAt) {
      const dueTime = new Date(task.dueAt).getTime()
      const createdTime = new Date(task.createdAt).getTime()
      if (dueTime < cutoffTime && createdTime < cutoffTime) {
        overdueMap.set(task.id, task)
      }
    }
  }
  const overdueTasks = Array.from(overdueMap.values()).sort((a, b) => {
    const dueA = a.dueAt ?? ''
    const dueB = b.dueAt ?? ''
    return dueA.localeCompare(dueB)
  })
  const overdueCount = overdueTasks.length

  if (period === 'daily') {
    return {
      period: 'daily',
      dateStr: selectedDateStr,
      startAt,
      endAt,
      isCurrentPeriod,
      cutoffAt,
      plannedCount,
      completedCount,
      completedPlannedCount,
      completionRate,
      carryOverCount,
      overdueCount,
      completedTasks,
      carryOverTasks,
      overdueTasks,
    } satisfies DailySummary
  }

  // Weekly Specific Calculations:
  // Build 7 days (Monday to Sunday)
  const zonedStart = toZonedTime(new Date(startAt), timeZone)
  const mondayStart = startOfDay(zonedStart)

  const dailyBreakdown: DayCompletedBreakdown[] = []
  const dayCompletedCounts: number[] = [0, 0, 0, 0, 0, 0, 0]

  for (let i = 0; i < 7; i++) {
    const dayZoned = addDays(mondayStart, i)
    const dayUtcInstant = fromZonedTime(dayZoned, timeZone)
    const dayDateStr = formatInTimeZone(dayUtcInstant, timeZone, 'yyyy-MM-dd')

    dailyBreakdown.push({
      dateStr: dayDateStr,
      dayOfWeek: i + 1,
      dayLabelKey: DAY_LABEL_KEYS[i],
      count: 0,
    })
  }

  // Distribute completed tasks to days
  for (const id of completedIds) {
    const instantIso = completionInstants.get(id)
    if (instantIso) {
      const instantDate = new Date(instantIso)
      const instantDateStr = formatInTimeZone(instantDate, timeZone, 'yyyy-MM-dd')
      const dayIndex = dailyBreakdown.findIndex((d) => d.dateStr === instantDateStr)
      if (dayIndex >= 0) {
        dayCompletedCounts[dayIndex]++
      }
    }
  }

  for (let i = 0; i < 7; i++) {
    dailyBreakdown[i].count = dayCompletedCounts[i]
  }

  // Most Productive Day:
  // Earliest local day tied for highest count; null if all counts are 0
  const maxCompleted = Math.max(...dayCompletedCounts)
  let mostProductiveDay: WeeklySummary['mostProductiveDay'] = null

  if (maxCompleted > 0) {
    const earliestIndex = dayCompletedCounts.findIndex((c) => c === maxCompleted)
    if (earliestIndex >= 0) {
      mostProductiveDay = {
        dateStr: dailyBreakdown[earliestIndex].dateStr,
        dayOfWeek: dailyBreakdown[earliestIndex].dayOfWeek,
        dayLabelKey: dailyBreakdown[earliestIndex].dayLabelKey,
        count: maxCompleted,
      }
    }
  }

  // Category Breakdown:
  // Count completed tasks by category; deleted/null maps to Uncategorized
  const categoryCountMap = new Map<string | null, number>()
  const validCategoryIds = new Set(categories.map((c) => c.id))

  for (const task of completedTasks) {
    const catId = task.categoryId && validCategoryIds.has(task.categoryId) ? task.categoryId : null
    categoryCountMap.set(catId, (categoryCountMap.get(catId) ?? 0) + 1)
  }

  const categoryBreakdown: CategorySummaryItem[] = []
  for (const [catId, count] of categoryCountMap.entries()) {
    if (catId === null) {
      categoryBreakdown.push({
        categoryId: null,
        name: 'Uncategorized',
        color: null,
        count,
        isUncategorized: true,
      })
    } else {
      const cat = categories.find((c) => c.id === catId)
      categoryBreakdown.push({
        categoryId: catId,
        name: cat?.name ?? 'Uncategorized',
        color: cat?.color ?? null,
        count,
        isUncategorized: false,
      })
    }
  }

  categoryBreakdown.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    if (a.isUncategorized) return 1
    if (b.isUncategorized) return -1
    return a.name.localeCompare(b.name)
  })

  // Previous-week comparison
  let comparisonVsPreviousWeek: WeeklyComparison | null = null
  if (previousWeekMetrics) {
    const diffCompletedCount = completedCount - previousWeekMetrics.completedCount
    let rateDiffPercentagePoints: number | null = null

    if (completionRate !== null && previousWeekMetrics.completionRate !== null) {
      rateDiffPercentagePoints = Math.round(
        (completionRate - previousWeekMetrics.completionRate) * 100
      )
    }

    comparisonVsPreviousWeek = {
      previousCompletedCount: previousWeekMetrics.completedCount,
      diffCompletedCount,
      previousRate: previousWeekMetrics.completionRate,
      rateDiffPercentagePoints,
    }
  }

  return {
    period: 'weekly',
    dateStr: selectedDateStr,
    weekStartStr: dailyBreakdown[0].dateStr,
    weekEndStr: dailyBreakdown[6].dateStr,
    startAt,
    endAt,
    isCurrentPeriod,
    cutoffAt,
    plannedCount,
    completedCount,
    completedPlannedCount,
    completionRate,
    carryOverCount,
    overdueCount,
    mostProductiveDay,
    dailyBreakdown,
    categoryBreakdown,
    comparisonVsPreviousWeek,
    completedTasks,
    carryOverTasks,
    overdueTasks,
  } satisfies WeeklySummary
}
