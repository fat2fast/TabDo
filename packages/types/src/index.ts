export type UserRole = 'admin' | 'user'
export type SupportedLocale = 'vi' | 'en'

export interface UserProfile {
  id: string
  role: UserRole
  displayName: string | null
  timezone: string
  isActive: boolean
  mustChangePassword: boolean
  locale: SupportedLocale
  createdAt: string
  updatedAt: string
}

export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'
export type DueDateKind = 'date_only' | 'date_time'

export interface Task {
  id: string
  userId: string
  categoryId?: string | null
  parentId?: string | null
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  dueDateKind: DueDateKind
  startAt?: string | null
  dueAt?: string | null
  sourceUrl?: string | null
  completedAt?: string | null
  recurrenceRule?: string | null
  recurrenceSeriesId?: string | null
  recurrenceParentId?: string | null
  recurrenceTimezone?: string | null
  recurrenceAnchorAt?: string | null
  createdAt: string
  updatedAt: string
}

export type RecurrenceType = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom'
export type RecurrenceWeekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'

export interface RecurrenceConfig {
  type: RecurrenceType
  days?: RecurrenceWeekday[]
}

export interface CompleteTaskAndGenerateNextResult {
  completedTask: Task
  nextTask: Task | null
  generated: boolean
  reusedExistingSuccessor: boolean
}

export interface CreateTaskInput {
  title: string
  description?: string | null
  categoryId?: string | null
  parentId?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  dueDateKind?: DueDateKind
  startAt?: string | null
  dueAt?: string | null
  sourceUrl?: string | null
  recurrenceRule?: string | null
  recurrenceSeriesId?: string | null
  recurrenceParentId?: string | null
  recurrenceTimezone?: string | null
  recurrenceAnchorAt?: string | null
}

export interface UpdateTaskInput {
  title?: string
  description?: string | null
  categoryId?: string | null
  parentId?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  dueDateKind?: DueDateKind
  startAt?: string | null
  dueAt?: string | null
  sourceUrl?: string | null
  completedAt?: string | null
  recurrenceRule?: string | null
  recurrenceSeriesId?: string | null
  recurrenceParentId?: string | null
  recurrenceTimezone?: string | null
  recurrenceAnchorAt?: string | null
  previousUpdatedAt?: string
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

export interface CreateCategoryInput {
  name: string
  icon?: string | null
  color?: string | null
}

export interface UpdateCategoryInput {
  name?: string
  icon?: string | null
  color?: string | null
}

export type ReminderStatus = 'pending' | 'triggered' | 'snoozed' | 'dismissed'
export type ReminderKind = 'absolute' | 'relative_due'

export interface Reminder {
  id: string
  userId: string
  taskId: string
  remindAt: string
  status: ReminderStatus
  snoozedUntil?: string | null
  reminderKind: ReminderKind
  offsetMinutes?: number | null
  effectiveAt: string
  createdAt: string
  updatedAt: string
}

export interface CreateReminderInput {
  taskId: string
  reminderKind: ReminderKind
  remindAt?: string
  offsetMinutes?: number | null
}

export interface UpdateReminderInput {
  remindAt?: string
  reminderKind?: ReminderKind
  offsetMinutes?: number | null
  status?: ReminderStatus
  snoozedUntil?: string | null
  previousUpdatedAt: string
}

export interface DeleteReminderInput {
  id: string
  previousUpdatedAt: string
}

export interface UpcomingReminder {
  id: string
  taskId: string
  taskTitle: string
  taskStatus: TaskStatus
  dueAt?: string | null
  reminderKind: ReminderKind
  offsetMinutes?: number | null
  remindAt: string
  effectiveAt: string
  status: ReminderStatus
  snoozedUntil?: string | null
  updatedAt: string
  taskUpdatedAt: string
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

export interface CreateScheduleBlockInput {
  title: string
  startAt: string
  endAt: string
  taskId?: string | null
}

export interface UpdateScheduleBlockInput {
  title?: string
  startAt?: string
  endAt?: string
  taskId?: string | null
  previousUpdatedAt: string
}

export interface DeleteScheduleBlockInput {
  id: string
  previousUpdatedAt: string
}

export interface TaskActivity {
  id: number | string
  userId: string
  taskId: string
  action: string
  metadata: Record<string, unknown>
  createdAt: string
}

export interface ExtensionTodayTask {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  dueDateKind: DueDateKind
  dueAt: string | null
  updatedAt: string
}

export interface AdminUserListItem {
  id: string
  email: string
  displayName: string | null
  role: UserRole
  isActive: boolean
  mustChangePassword: boolean
  locale: SupportedLocale
  createdAt: string
  updatedAt: string
  bannedUntil: string | null
  taskCount: number
  todoCount: number
  inProgressCount: number
  doneCount: number
}

export interface AdminUsersQueryParams {
  page?: number
  pageSize?: number
  search?: string
  role?: UserRole | 'all'
  status?: 'active' | 'inactive' | 'all'
  sortBy?: 'createdAt' | 'email' | 'displayName' | 'taskCount'
  sortOrder?: 'asc' | 'desc'
}

export interface AdminUsersResponse {
  users: AdminUserListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface AdminDashboardStats {
  totalUsers: number
  activeUsers: number
  inactiveUsers: number
  totalTasks: number
  todoTasks: number
  inProgressTasks: number
  doneTasks: number
}

export interface AdminUserLifecycleInput {
  userId: string
  action: 'activate' | 'deactivate'
}

export interface CompleteInitialPasswordInput {
  newPassword: string
}
