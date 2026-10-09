import { supabase } from '../../../lib/supabase'

export type TaskActivityAction =
  | 'created'
  | 'updated'
  | 'completed'
  | 'reopened'
  | 'deadline_changed'
  | 'priority_changed'
  | 'schedule_created'
  | 'schedule_updated'
  | 'schedule_deleted'
  | 'recurrence_enabled'
  | 'recurrence_changed'
  | 'recurrence_disabled'
  | 'next_occurrence_generated'

export interface RecordActivityParams {
  userId: string
  taskId: string
  action: TaskActivityAction
  metadata?: Record<string, unknown>
}

export async function recordTaskActivity({
  userId,
  taskId,
  action,
  metadata = {},
}: RecordActivityParams) {
  const { error } = await supabase.from('task_activities').insert({
    user_id: userId,
    task_id: taskId,
    action,
    metadata,
  })

  if (error) {
    console.error('Failed to record task activity:', error.message)
  }
}
