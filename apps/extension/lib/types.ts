import type {
  TaskPriority,
  TaskStatus,
  DueDateKind,
  UpcomingReminder,
  ExtensionTodayTask,
} from '@tabdo/types'

export type { ExtensionTodayTask }

export interface ExtensionSyncMetadata {
  lastSuccessfulSyncAt: string | null
  lastSyncError: string | null
  isStale: boolean
}

export interface ExtensionUserCache {
  userId: string
  todayTasks: ExtensionTodayTask[]
  upcomingReminders: UpcomingReminder[]
  metadata: ExtensionSyncMetadata
}

export interface ExtensionNotificationContext {
  notificationId: string
  reminderId: string
  taskId: string
  taskTitle: string
  dueAt: string | null
  effectiveAt: string
  reminderUpdatedAt: string
  taskUpdatedAt: string
}

export interface ExtensionAuthUser {
  id: string
  email: string
  displayName: string | null
  timezone: string
}

export type ExtensionAuthStatus = 'loading' | 'unauthenticated' | 'authenticated'

export interface ExtensionState {
  status: ExtensionAuthStatus
  user: ExtensionAuthUser | null
  todayTasks: ExtensionTodayTask[]
  syncMetadata: ExtensionSyncMetadata
}

export interface QuickAddPayload {
  title: string
  sourceUrl?: string | null
  description?: string | null
  priority?: 'low' | 'medium' | 'high'
  dueOption?: 'today' | 'tomorrow' | 'inbox'
}

export type ExtensionMessage =
  | { type: 'get-state' }
  | { type: 'sign-in'; payload: { email: string; password: string } }
  | { type: 'sign-out' }
  | { type: 'sync' }
  | { type: 'quick-add'; payload: QuickAddPayload }
  | { type: 'complete-task'; payload: { taskId: string; previousUpdatedAt?: string } }
  | { type: 'snooze-reminder'; payload: { reminderId: string; minutes: number; previousUpdatedAt?: string } }
  | { type: 'open-task'; payload: { taskId: string } }

export type ExtensionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export interface ExistingAlarmSnapshot {
  name: string
  scheduledTime: number
}

export interface DesiredAlarm {
  name: string
  scheduledTime: number
}

export interface AlarmReconciliationResult {
  alarmsToCreate: DesiredAlarm[]
  alarmsToRemove: string[]
}
