import type {
  CreateScheduleBlockInput,
  DeleteScheduleBlockInput,
  ScheduleBlock,
  UpdateScheduleBlockInput,
} from '@tabdo/types'

export type {
  CreateScheduleBlockInput,
  DeleteScheduleBlockInput,
  ScheduleBlock,
  UpdateScheduleBlockInput,
}

export interface ScheduleBlockRow {
  id: string
  user_id: string
  task_id: string | null
  title: string
  start_at: string
  end_at: string
  created_at: string
  updated_at: string
}

export function toScheduleBlock(row: ScheduleBlockRow): ScheduleBlock {
  return {
    id: row.id,
    userId: row.user_id,
    taskId: row.task_id,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
