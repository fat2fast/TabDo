import type { Task, TaskPriority } from '../tasks/types'
import type { ScheduleBlock } from '../scheduling/types'

export interface DashboardMetrics {
  relevantCount: number
  completedCount: number
  remainingCount: number
  overdueCount: number
  completionPercentage: number
}

export interface TodayScheduleItem {
  id: string
  title: string
  startAt: string
  endAt: string
  taskId: string | null
  taskTitle: string | null
  taskStatus: 'todo' | 'in_progress' | 'done' | null
  taskPriority: TaskPriority | null
}

export interface DashboardSnapshot {
  metrics: DashboardMetrics
  priorityTasks: Task[]
  overdueTasks: Task[]
  todaySchedule: TodayScheduleItem[]
  upcomingTasks: Task[]
}

export interface DashboardRawData {
  incompleteTasks: Task[]
  completedTodayTasks: Task[]
  todayBlocks: (ScheduleBlock & { task?: Task | null })[]
  upcomingTasks: Task[]
}
