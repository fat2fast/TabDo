import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createScheduleBlock,
  deleteScheduleBlock,
  getScheduleBlocksByTask,
  getScheduleBlocksInRange,
  updateScheduleBlock,
} from '../api/schedule-blocks'
import { supabase } from '../../../lib/supabase'

vi.mock('../../../lib/supabase', () => {
  return {
    supabase: {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn(),
    },
  }
})

describe('schedule-block-api', () => {
  const mockUser = {
    id: 'user-abc-123',
    email: 'test@tabdo.local',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser as any },
      error: null,
    })
  })

  describe('getScheduleBlocksInRange', () => {
    it('applies visible range predicates (start_at < rangeEnd and end_at > rangeStart) ordered by start_at', async () => {
      const mockRows = [
        {
          id: 'block-1',
          user_id: 'user-abc-123',
          task_id: 'task-1',
          title: 'Deep Work',
          start_at: '2026-10-06T09:00:00.000Z',
          end_at: '2026-10-06T11:00:00.000Z',
          created_at: '2026-10-06T08:00:00.000Z',
          updated_at: '2026-10-06T08:00:00.000Z',
        },
      ]

      const queryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockRows, error: null }),
      }

      vi.mocked(supabase.from).mockReturnValue(queryBuilder)

      const start = '2026-10-06T00:00:00.000Z'
      const end = '2026-10-07T00:00:00.000Z'
      const result = await getScheduleBlocksInRange(supabase, start, end)

      expect(supabase.from).toHaveBeenCalledWith('schedule_blocks')
      expect(queryBuilder.select).toHaveBeenCalledWith('*')
      expect(queryBuilder.lt).toHaveBeenCalledWith('start_at', end)
      expect(queryBuilder.gt).toHaveBeenCalledWith('end_at', start)
      expect(queryBuilder.order).toHaveBeenCalledWith('start_at', { ascending: true })

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        id: 'block-1',
        userId: 'user-abc-123',
        taskId: 'task-1',
        title: 'Deep Work',
        startAt: '2026-10-06T09:00:00.000Z',
        endAt: '2026-10-06T11:00:00.000Z',
        createdAt: '2026-10-06T08:00:00.000Z',
        updatedAt: '2026-10-06T08:00:00.000Z',
      })
    })
  })

  describe('getScheduleBlocksByTask', () => {
    it('queries schedule blocks by task_id ordered by start_at', async () => {
      const mockRows = [
        {
          id: 'block-2',
          user_id: 'user-abc-123',
          task_id: 'task-99',
          title: 'Session 1',
          start_at: '2026-10-06T13:00:00.000Z',
          end_at: '2026-10-06T14:00:00.000Z',
          created_at: '2026-10-06T08:00:00.000Z',
          updated_at: '2026-10-06T08:00:00.000Z',
        },
      ]

      const queryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockRows, error: null }),
      }

      vi.mocked(supabase.from).mockReturnValue(queryBuilder)

      const result = await getScheduleBlocksByTask(supabase, 'task-99')
      expect(queryBuilder.eq).toHaveBeenCalledWith('task_id', 'task-99')
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Session 1')
    })
  })

  describe('createScheduleBlock', () => {
    it('rejects blank title, overlong title, and invalid temporal order before hitting database', async () => {
      await expect(
        createScheduleBlock(supabase, {
          title: '   ',
          startAt: '2026-10-06T09:00:00.000Z',
          endAt: '2026-10-06T10:00:00.000Z',
        })
      ).rejects.toThrow('Title cannot be blank')

      await expect(
        createScheduleBlock(supabase, {
          title: 'a'.repeat(501),
          startAt: '2026-10-06T09:00:00.000Z',
          endAt: '2026-10-06T10:00:00.000Z',
        })
      ).rejects.toThrow('Title cannot exceed 500 characters')

      await expect(
        createScheduleBlock(supabase, {
          title: 'Invalid Order',
          startAt: '2026-10-06T10:00:00.000Z',
          endAt: '2026-10-06T09:00:00.000Z',
        })
      ).rejects.toThrow('End time must be after start time')
    })

    it('sets user_id strictly from the authenticated session and logs task activity if linked', async () => {
      const mockCreatedRow = {
        id: 'block-new',
        user_id: 'user-abc-123',
        task_id: 'task-linked',
        title: 'New Session',
        start_at: '2026-10-06T14:00:00.000Z',
        end_at: '2026-10-06T15:00:00.000Z',
        created_at: '2026-10-06T08:00:00.000Z',
        updated_at: '2026-10-06T08:00:00.000Z',
      }

      const queryBuilder: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockCreatedRow, error: null }),
      }

      const activityBuilder: any = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      }

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'task_activities') return activityBuilder
        return queryBuilder
      })

      const res = await createScheduleBlock(supabase, {
        title: 'New Session',
        startAt: '2026-10-06T14:00:00.000Z',
        endAt: '2026-10-06T15:00:00.000Z',
        taskId: 'task-linked',
      })

      expect(queryBuilder.insert).toHaveBeenCalledWith({
        user_id: 'user-abc-123',
        task_id: 'task-linked',
        title: 'New Session',
        start_at: '2026-10-06T14:00:00.000Z',
        end_at: '2026-10-06T15:00:00.000Z',
      })
      expect(res.id).toBe('block-new')
      expect(activityBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'schedule_created',
          task_id: 'task-linked',
          user_id: 'user-abc-123',
        })
      )
    })
  })

  describe('updateScheduleBlock and optimistic concurrency', () => {
    it('predicates update on id and previousUpdatedAt, throwing a conflict error when 0 rows return', async () => {
      const queryBuilder: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      }

      vi.mocked(supabase.from).mockReturnValue(queryBuilder)

      await expect(
        updateScheduleBlock(supabase, 'block-1', {
          title: 'Renamed',
          previousUpdatedAt: '2026-10-06T08:00:00.000Z',
        })
      ).rejects.toThrow(/updated or deleted by another session/)

      expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'block-1')
      expect(queryBuilder.eq).toHaveBeenCalledWith('updated_at', '2026-10-06T08:00:00.000Z')
    })

    it('updates schedule block without altering any task deadlines', async () => {
      const updatedRow = {
        id: 'block-1',
        user_id: 'user-abc-123',
        task_id: 'task-1',
        title: 'Updated Title',
        start_at: '2026-10-06T10:00:00.000Z',
        end_at: '2026-10-06T12:00:00.000Z',
        created_at: '2026-10-06T08:00:00.000Z',
        updated_at: '2026-10-06T08:30:00.000Z',
      }

      const queryBuilder: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [updatedRow], error: null }),
      }

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'task_activities') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) } as any
        }
        return queryBuilder
      })

      const res = await updateScheduleBlock(supabase, 'block-1', {
        title: 'Updated Title',
        startAt: '2026-10-06T10:00:00.000Z',
        endAt: '2026-10-06T12:00:00.000Z',
        previousUpdatedAt: '2026-10-06T08:00:00.000Z',
      })

      expect(res.title).toBe('Updated Title')
      // Ensure only schedule_blocks table was touched for update, not tasks table
      expect(supabase.from).toHaveBeenCalledWith('schedule_blocks')
      expect(supabase.from).not.toHaveBeenCalledWith('tasks')
    })
  })

  describe('deleteScheduleBlock and optimistic concurrency', () => {
    it('predicates delete on id and previousUpdatedAt, throwing conflict if 0 rows returned', async () => {
      const selectBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }

      const deleteBuilder: any = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      }

      let callCount = 0
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++
        if (callCount === 1) return selectBuilder
        return deleteBuilder
      })

      await expect(
        deleteScheduleBlock(supabase, 'block-1', '2026-10-06T08:00:00.000Z')
      ).rejects.toThrow(/updated or deleted by another session/)

      expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'block-1')
      expect(deleteBuilder.eq).toHaveBeenCalledWith('updated_at', '2026-10-06T08:00:00.000Z')
    })
  })
})
