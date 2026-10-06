import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  completeTask,
  createTask,
  deleteTask,
  getTaskList,
  reopenTask,
  updateTask,
} from '../api/tasks'
import type { Task, TaskListQueryInput } from '../types'
import { supabase } from '../../../lib/supabase'

vi.mock('../../../lib/supabase', () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn(),
      },
      from: vi.fn(),
    },
  }
})

describe('task-api functions', () => {
  const mockSession = {
    user: {
      id: 'test-user-id-123',
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession as any },
      error: null,
    })
  })

  describe('getTaskList query predicates', () => {
    it('applies correct predicates for inbox view (active, no due date)', async () => {
      const mockQueryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }

      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder)

      const input: TaskListQueryInput = {
        view: 'inbox',
        timeZone: 'Asia/Ho_Chi_Minh',
        now: new Date('2026-10-05T12:00:00Z'),
      }

      await getTaskList(input)

      expect(supabase.from).toHaveBeenCalledWith('tasks')
      expect(mockQueryBuilder.neq).toHaveBeenCalledWith('status', 'done')
      expect(mockQueryBuilder.is).toHaveBeenCalledWith('due_at', null)
      expect(mockQueryBuilder.is).not.toHaveBeenCalledWith('category_id', null)
    })

    it('applies category_id IS NULL when categoryId is none or null', async () => {
      const mockQueryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }

      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder)

      const input: TaskListQueryInput = {
        view: 'inbox',
        categoryId: 'none',
        timeZone: 'Asia/Ho_Chi_Minh',
        now: new Date('2026-10-05T12:00:00Z'),
      }

      await getTaskList(input)

      expect(mockQueryBuilder.is).toHaveBeenCalledWith('category_id', null)
    })

    it('applies correct predicates for completed view and orders by completed_at desc', async () => {
      const mockQueryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }

      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder)

      const input: TaskListQueryInput = {
        view: 'completed',
        timeZone: 'Asia/Ho_Chi_Minh',
        now: new Date('2026-10-05T12:00:00Z'),
      }

      await getTaskList(input)

      expect(supabase.from).toHaveBeenCalledWith('tasks')
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('status', 'done')
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('completed_at', { ascending: false })
    })

    it('orders by database priority_rank rather than alphabetical priority when sorted by priority', async () => {
      const mockQueryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }

      vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder)

      const input: TaskListQueryInput = {
        view: 'inbox',
        sort: 'priority',
        timeZone: 'Asia/Ho_Chi_Minh',
        now: new Date('2026-10-05T12:00:00Z'),
      }

      await getTaskList(input)

      expect(mockQueryBuilder.order).toHaveBeenCalledWith('priority_rank', { ascending: false })
      expect(mockQueryBuilder.order).not.toHaveBeenCalledWith('priority', expect.anything())
    })
  })

  describe('createTask validation and activity', () => {
    it('rejects blank title before calling Supabase', async () => {
      await expect(createTask({ title: '   ' })).rejects.toThrow(/cannot be blank/i)
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('rejects title longer than 500 characters', async () => {
      await expect(createTask({ title: 'x'.repeat(501) })).rejects.toThrow(/exceed 500 characters/i)
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('inserts task with session user_id and logs created activity', async () => {
      const insertedRow = {
        id: 'new-task-id',
        user_id: 'test-user-id-123',
        title: 'New Valid Task',
        status: 'todo',
        priority: 'medium',
        due_date_kind: 'date_time',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const tasksBuilder: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: insertedRow, error: null }),
      }

      const activitiesBuilder: any = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      }

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'tasks') return tasksBuilder
        if (table === 'task_activities') return activitiesBuilder
        return {} as any
      })

      const task = await createTask({ title: 'New Valid Task' })

      expect(task.id).toBe('new-task-id')
      expect(tasksBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'test-user-id-123',
          title: 'New Valid Task',
          priority: 'medium',
        })
      )
      expect(activitiesBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'test-user-id-123',
          task_id: 'new-task-id',
          action: 'created',
        })
      )
    })
  })

  describe('completion, reopening, and deletion', () => {
    const existingTask: Task = {
      id: 'existing-task-id',
      userId: 'test-user-id-123',
      title: 'Existing Task',
      status: 'todo',
      priority: 'high',
      dueDateKind: 'date_time',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    }

    it('sends status done and completed_at on completeTask', async () => {
      const updatedRow = {
        ...existingTask,
        status: 'done',
        completed_at: '2026-10-05T12:00:00Z',
        user_id: 'test-user-id-123',
        due_date_kind: 'date_time',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-05T12:00:00Z',
      }

      const tasksBuilder: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: updatedRow, error: null }),
      }

      const activitiesBuilder: any = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      }

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'tasks') return tasksBuilder
        if (table === 'task_activities') return activitiesBuilder
        return {} as any
      })

      const completed = await completeTask(existingTask)

      expect(completed.status).toBe('done')
      expect(tasksBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'done',
          completed_at: expect.any(String),
        })
      )
      expect(activitiesBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'completed',
        })
      )
    })

    it('sends status todo and null completed_at on reopenTask', async () => {
      const doneTask: Task = {
        ...existingTask,
        status: 'done',
        completedAt: '2026-10-05T12:00:00Z',
      }

      const reopenedRow = {
        ...existingTask,
        status: 'todo',
        completed_at: null,
        user_id: 'test-user-id-123',
        due_date_kind: 'date_time',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-05T12:05:00Z',
      }

      const tasksBuilder: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: reopenedRow, error: null }),
      }

      const activitiesBuilder: any = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      }

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'tasks') return tasksBuilder
        if (table === 'task_activities') return activitiesBuilder
        return {} as any
      })

      const reopened = await reopenTask(doneTask)

      expect(reopened.status).toBe('todo')
      expect(tasksBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'todo',
          completed_at: null,
        })
      )
      expect(activitiesBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'reopened',
        })
      )
    })

    it('deletes task without inserting post-delete activity', async () => {
      const tasksBuilder: any = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      }

      const activitiesBuilder: any = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      }

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'tasks') return tasksBuilder
        if (table === 'task_activities') return activitiesBuilder
        return {} as any
      })

      await deleteTask('task-to-delete-id')

      expect(tasksBuilder.delete).toHaveBeenCalled()
      expect(tasksBuilder.eq).toHaveBeenCalledWith('id', 'task-to-delete-id')
      // Must NOT log activity because foreign key cascades on delete
      expect(activitiesBuilder.insert).not.toHaveBeenCalled()
    })

    it('rejects update with concurrent modification conflict when previousUpdatedAt does not match', async () => {
      const tasksBuilder: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
        }),
      }

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'tasks') return tasksBuilder
        return {} as any
      })

      await expect(
        updateTask('existing-task-id', {
          dueAt: '2026-10-10T12:00:00Z',
          previousUpdatedAt: '2026-10-01T00:00:00Z',
        })
      ).rejects.toThrow(/concurrent modification conflict/i)

      expect(tasksBuilder.eq).toHaveBeenCalledWith('id', 'existing-task-id')
      expect(tasksBuilder.eq).toHaveBeenCalledWith('updated_at', '2026-10-01T00:00:00Z')
    })

    it('rejects completeTask when task was updated concurrently', async () => {
      const tasksBuilder: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
        }),
      }

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'tasks') return tasksBuilder
        return {} as any
      })

      await expect(completeTask(existingTask)).rejects.toThrow(/concurrent modification conflict/i)
      expect(tasksBuilder.eq).toHaveBeenCalledWith('id', existingTask.id)
      expect(tasksBuilder.eq).toHaveBeenCalledWith('updated_at', existingTask.updatedAt)
    })
  })
})
