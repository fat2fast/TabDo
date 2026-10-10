import type { Category, ScheduleBlock, Task } from '@tabdo/types'

export type SummaryPeriod = 'daily' | 'weekly'

export interface TaskActivitySummaryItem {
  id: string
  taskId: string
  action: string
  createdAt: string
}

export interface DayCompletedBreakdown {
  dateStr: string // YYYY-MM-DD
  dayOfWeek: number // 1 = Monday, ..., 7 = Sunday
  dayLabelKey: string // 'summary.dayMon', etc.
  count: number
}

export interface CategorySummaryItem {
  categoryId: string | null
  name: string
  color: string | null
  count: number
  isUncategorized: boolean
}

export interface WeeklyComparison {
  previousCompletedCount: number
  diffCompletedCount: number
  previousRate: number | null
  rateDiffPercentagePoints: number | null
}

export interface DailySummary {
  period: 'daily'
  dateStr: string
  startAt: string
  endAt: string
  isCurrentPeriod: boolean
  cutoffAt: string
  plannedCount: number
  completedCount: number
  completedPlannedCount: number
  completionRate: number | null
  carryOverCount: number
  overdueCount: number
  completedTasks: Task[]
  carryOverTasks: Task[]
  overdueTasks: Task[]
}

export interface WeeklySummary {
  period: 'weekly'
  dateStr: string
  weekStartStr: string
  weekEndStr: string
  startAt: string
  endAt: string
  isCurrentPeriod: boolean
  cutoffAt: string
  plannedCount: number
  completedCount: number
  completedPlannedCount: number
  completionRate: number | null
  carryOverCount: number
  overdueCount: number
  mostProductiveDay: {
    dateStr: string
    dayOfWeek: number
    dayLabelKey: string
    count: number
  } | null
  dailyBreakdown: DayCompletedBreakdown[]
  categoryBreakdown: CategorySummaryItem[]
  comparisonVsPreviousWeek: WeeklyComparison | null
  completedTasks: Task[]
  carryOverTasks: Task[]
  overdueTasks: Task[]
}

export type SummaryData = DailySummary | WeeklySummary

export interface PreviousWeekMetrics {
  plannedCount: number
  completedCount: number
  completedPlannedCount: number
  completionRate: number | null
}

export interface DeriveSummaryInput {
  period: SummaryPeriod
  selectedDateStr: string
  timeZone: string
  referenceNow: Date
  tasksDueInPeriod: Task[]
  tasksCompletedInPeriod: Task[]
  scheduleBlocksInPeriod: (ScheduleBlock & { task?: Task | null })[]
  completedActivitiesInPeriod: TaskActivitySummaryItem[]
  survivingActivityTasks: Task[]
  incompleteCutoffTasks: Task[]
  categories: Category[]
  previousWeekMetrics?: PreviousWeekMetrics | null
}
