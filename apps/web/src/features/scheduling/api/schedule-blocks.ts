import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '../../../lib/supabase'
import { recordTaskActivity } from '../../tasks/api/task-activities'
import type {
  CreateScheduleBlockInput,
  ScheduleBlock,
  ScheduleBlockRow,
  UpdateScheduleBlockInput,
} from '../types'
import { toScheduleBlock } from '../types'

export async function getScheduleBlocksInRange(
  client: SupabaseClient = defaultClient,
  rangeStart: string,
  rangeEnd: string
): Promise<ScheduleBlock[]> {
  const { data, error } = await client
    .from('schedule_blocks')
    .select('*')
    .lt('start_at', rangeEnd)
    .gt('end_at', rangeStart)
    .order('start_at', { ascending: true })

  if (error) throw error
  return (data as ScheduleBlockRow[]).map(toScheduleBlock)
}

export async function getScheduleBlocksByTask(
  client: SupabaseClient = defaultClient,
  taskId: string
): Promise<ScheduleBlock[]> {
  const { data, error } = await client
    .from('schedule_blocks')
    .select('*')
    .eq('task_id', taskId)
    .order('start_at', { ascending: true })

  if (error) throw error
  return (data as ScheduleBlockRow[]).map(toScheduleBlock)
}

export async function createScheduleBlock(
  client: SupabaseClient = defaultClient,
  input: CreateScheduleBlockInput
): Promise<ScheduleBlock> {
  const title = input.title?.trim()
  if (!title) {
    throw new Error('Title cannot be blank')
  }
  if (title.length > 500) {
    throw new Error('Title cannot exceed 500 characters')
  }
  if (new Date(input.endAt).getTime() <= new Date(input.startAt).getTime()) {
    throw new Error('End time must be after start time')
  }

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser()

  if (authError || !user) {
    throw new Error('User must be authenticated to create schedule blocks')
  }

  const { data, error } = await client
    .from('schedule_blocks')
    .insert({
      user_id: user.id,
      task_id: input.taskId || null,
      title,
      start_at: input.startAt,
      end_at: input.endAt,
    })
    .select()
    .single()

  if (error) throw error
  const created = toScheduleBlock(data as ScheduleBlockRow)

  if (created.taskId) {
    await recordTaskActivity({
      userId: user.id,
      taskId: created.taskId,
      action: 'schedule_created',
      metadata: {
        scheduleBlockId: created.id,
        title: created.title,
        startAt: created.startAt,
        endAt: created.endAt,
      },
    })
  }

  return created
}

export async function updateScheduleBlock(
  client: SupabaseClient = defaultClient,
  id: string,
  input: UpdateScheduleBlockInput
): Promise<ScheduleBlock> {
  if (input.title !== undefined) {
    const title = input.title.trim()
    if (!title) throw new Error('Title cannot be blank')
    if (title.length > 500) throw new Error('Title cannot exceed 500 characters')
  }
  if (input.startAt !== undefined && input.endAt !== undefined) {
    if (new Date(input.endAt).getTime() <= new Date(input.startAt).getTime()) {
      throw new Error('End time must be after start time')
    }
  }

  const updatePayload: Record<string, unknown> = {}
  if (input.title !== undefined) updatePayload.title = input.title.trim()
  if (input.startAt !== undefined) updatePayload.start_at = input.startAt
  if (input.endAt !== undefined) updatePayload.end_at = input.endAt
  if (input.taskId !== undefined) updatePayload.task_id = input.taskId || null

  const { data, error } = await client
    .from('schedule_blocks')
    .update(updatePayload)
    .eq('id', id)
    .eq('updated_at', input.previousUpdatedAt)
    .select()

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('Schedule block was updated or deleted by another session. Please refresh.')
  }

  const updated = toScheduleBlock(data[0] as ScheduleBlockRow)

  if (updated.taskId) {
    const {
      data: { user },
    } = await client.auth.getUser()
    if (user) {
      await recordTaskActivity({
        userId: user.id,
        taskId: updated.taskId,
        action: 'schedule_updated',
        metadata: {
          scheduleBlockId: updated.id,
          title: updated.title,
          startAt: updated.startAt,
          endAt: updated.endAt,
        },
      })
    }
  }

  return updated
}

export async function deleteScheduleBlock(
  client: SupabaseClient = defaultClient,
  id: string,
  previousUpdatedAt: string
): Promise<void> {
  // Read existing block to log activity if linked
  const { data: existingRows } = await client
    .from('schedule_blocks')
    .select('*')
    .eq('id', id)

  const existing =
    existingRows && existingRows[0] ? toScheduleBlock(existingRows[0] as ScheduleBlockRow) : null

  const { data, error } = await client
    .from('schedule_blocks')
    .delete()
    .eq('id', id)
    .eq('updated_at', previousUpdatedAt)
    .select()

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('Schedule block was updated or deleted by another session. Please refresh.')
  }

  if (existing?.taskId) {
    const {
      data: { user },
    } = await client.auth.getUser()
    if (user) {
      await recordTaskActivity({
        userId: user.id,
        taskId: existing.taskId,
        action: 'schedule_deleted',
        metadata: {
          scheduleBlockId: existing.id,
          title: existing.title,
        },
      })
    }
  }
}
