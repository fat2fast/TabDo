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
      rpc: vi.fn(),
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
        or: vi.fn().mockReturnThis(),
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
      // By default all active tasks are returned in Tất cả view
      expect(mockQueryBuilder.is).not.toHaveBeenCalledWith('due_at', null)

      // When scope is unorganized, applies or condition
      await getTaskList({ ...input, scope: 'unorganized' })
      expect(mockQueryBuilder.or).toHaveBeenCalledWith('category_id.is.null,due_at.is.null')

      // When scope is no_due, applies is null condition
      await getTaskList({ ...input, scope: 'no_due' })
      expect(mockQueryBuilder.is).toHaveBeenCalledWith('due_at', null)
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

    it('calls complete_task_and_generate_next RPC and returns result without duplicate client-side activity writes', async () => {
      const completedTaskRow = {
        id: existingTask.id,
        user_id: 'test-user-id-123',
        title: existingTask.title,
        status: 'done',
        priority: 'high',
        due_date_kind: 'date_time',
        due_at: '2026-10-05T12:00:00Z',
        completed_at: '2026-10-05T12:00:00Z',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-05T12:00:00Z',
      }
      const nextTaskRow = {
        id: 'next-task-id',
        user_id: 'test-user-id-123',
        title: existingTask.title,
        status: 'todo',
        priority: 'high',
        due_date_kind: 'date_time',
        due_at: '2026-10-06T12:00:00Z',
        completed_at: null,
        recurrence_rule: 'FREQ=DAILY',
        recurrence_parent_id: existingTask.id,
        created_at: '2026-10-05T12:00:00Z',
        updated_at: '2026-10-05T12:00:00Z',
      }

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: {
          completedTask: completedTaskRow,
          nextTask: nextTaskRow,
          generated: true,
          reusedExistingSuccessor: false,
        },
        error: null,
      } as any)

      const activitiesBuilder: any = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      }

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'task_activities') return activitiesBuilder
        return {} as any
      })

      const res = await completeTask(existingTask)

      expect(supabase.rpc).toHaveBeenCalledWith('complete_task_and_generate_next', {
        p_task_id: existingTask.id,
        p_expected_updated_at: existingTask.updatedAt,
      })
      expect(res.completedTask.status).toBe('done')
      expect(res.nextTask?.id).toBe('next-task-id')
      expect(res.generated).toBe(true)
      // The SQL RPC atomically records 'completed' and 'next_occurrence_generated' activities.
      // The Web client must NOT write them again to avoid duplicate audit records.
      expect(activitiesBuilder.insert).not.toHaveBeenCalled()
    })

    it('blocks reopenTask when a recurrence successor exists', async () => {
      const doneTask: Task = {
        ...existingTask,
        status: 'done',
        completedAt: '2026-10-05T12:00:00Z',
      }

      const tasksBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'successor-task-id' },
          error: null,
        }),
      }

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'tasks') return tasksBuilder
        return {} as any
      })

      await expect(reopenTask(doneTask)).rejects.toThrow(
        'Không thể mở lại công việc lặp lại đã có phiên lặp tiếp theo'
      )
      expect(tasksBuilder.select).toHaveBeenCalledWith('id')
      expect(tasksBuilder.eq).toHaveBeenCalledWith('recurrence_parent_id', doneTask.id)
    })

    it('sends status todo and null completed_at on reopenTask when no successor exists', async () => {
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

      const tasksSelectBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: reopenedRow, error: null }),
      }

      const activitiesBuilder: any = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      }

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'tasks') return tasksSelectBuilder
        if (table === 'task_activities') return activitiesBuilder
        return {} as any
      })

      const reopened = await reopenTask(doneTask)

      expect(reopened.status).toBe('todo')
      expect(tasksSelectBuilder.update).toHaveBeenCalledWith(
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
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { code: '40001', message: 'could not serialize access due to concurrent update' },
      } as any)

      await expect(completeTask(existingTask)).rejects.toThrow(/concurrent modification conflict/i)
      expect(supabase.rpc).toHaveBeenCalledWith('complete_task_and_generate_next', {
        p_task_id: existingTask.id,
        p_expected_updated_at: existingTask.updatedAt,
      })
    })

    it('logs recurrence activity when recurrenceRule is changed', async () => {
      let currentRule: string | null = null
      const tasksBuilder: any = {
        update: vi.fn().mockImplementation((updates: any) => {
          if (updates.recurrence_rule !== undefined) {
            currentRule = updates.recurrence_rule
          }
          return tasksBuilder
        }),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() =>
          Promise.resolve({
            data: {
              ...existingTask,
              recurrence_rule: currentRule,
              user_id: 'test-user-id-123',
              due_date_kind: 'date_time',
              created_at: '2026-10-01T00:00:00Z',
              updated_at: '2026-10-05T12:05:00Z',
            },
            error: null,
          })
        ),
      }

      const activitiesBuilder: any = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      }

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'tasks') return tasksBuilder
        if (table === 'task_activities') return activitiesBuilder
        return {} as any
      })

      // Enabling recurrence
      await updateTask('existing-task-id', { recurrenceRule: 'FREQ=WEEKLY' }, existingTask)
      expect(activitiesBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'recurrence_enabled',
          metadata: { rule: 'FREQ=WEEKLY' },
        })
      )

      // Changing recurrence
      const taskWithWeekly = { ...existingTask, recurrenceRule: 'FREQ=WEEKLY' }
      await updateTask('existing-task-id', { recurrenceRule: 'FREQ=DAILY' }, taskWithWeekly)
      expect(activitiesBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'recurrence_changed',
          metadata: { from: 'FREQ=WEEKLY', to: 'FREQ=DAILY' },
        })
      )

      // Disabling recurrence
      await updateTask('existing-task-id', { recurrenceRule: null }, taskWithWeekly)
      expect(activitiesBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'recurrence_disabled',
        })
      )
    })
  })
})
