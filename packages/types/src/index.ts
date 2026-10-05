export type UserRole = 'admin' | 'user'

export interface UserProfile {
  id: string
  role: UserRole
  displayName: string | null
  timezone: string
  createdAt: string
  updatedAt: string
}

export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  userId: string
  categoryId?: string | null
  parentId?: string | null
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  startAt?: string | null
  dueAt?: string | null
  sourceUrl?: string | null
  completedAt?: string | null
  recurrenceRule?: string | null
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  userId: string
  name: string
  icon?: string | null
  color?: string | null
  createdAt: string
  updatedAt: string
}

export type ReminderStatus = 'pending' | 'triggered' | 'snoozed' | 'dismissed'

export interface Reminder {
  id: string
  userId: string
  taskId: string
  remindAt: string
  status: ReminderStatus
  snoozedUntil?: string | null
  createdAt: string
  updatedAt: string
}

export interface ScheduleBlock {
  id: string
  userId: string
  taskId?: string | null
  title: string
  startAt: string
  endAt: string
  createdAt: string
  updatedAt: string
}

export interface TaskActivity {
  id: number | string
  userId: string
  taskId: string
  action: string
  metadata: Record<string, unknown>
  createdAt: string
}
