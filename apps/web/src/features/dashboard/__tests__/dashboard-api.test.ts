import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchDashboardSnapshot } from '../api/dashboard'
import { supabase } from '../../../lib/supabase'

vi.mock('../../../lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  }
})

describe('fetchDashboardSnapshot API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs queries with correct predicates and maps snapshot including in-progress tasks', async () => {
    const incompleteBuilder: any = {
      is: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'task-1',
            user_id: 'user-1',
            title: 'Incomplete Task',
            status: 'todo',
            priority: 'high',
            due_date_kind: 'date_time',
            due_at: '2026-10-09T08:00:00.000Z',
            created_at: '2026-10-01T00:00:00.000Z',
            updated_at: '2026-10-01T00:00:00.000Z',
          },
        ],
        error: null,
      }),
    }

    const completedBuilder: any = {
      is: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'task-2',
            user_id: 'user-1',
            title: 'Done Task',
            status: 'done',
            priority: 'medium',
            due_date_kind: 'date_time',
            due_at: '2026-10-09T04:00:00.000Z',
            completed_at: '2026-10-09T05:00:00.000Z',
            created_at: '2026-10-01T00:00:00.000Z',
            updated_at: '2026-10-09T05:00:00.000Z',
          },
        ],
        error: null,
      }),
    }

    const inProgressBuilder: any = {
      is: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'task-3',
            user_id: 'user-1',
            title: 'In Progress Task',
            status: 'in_progress',
            priority: 'high',
            due_date_kind: 'date_time',
            due_at: '2026-10-09T09:00:00.000Z',
            created_at: '2026-10-01T00:00:00.000Z',
            updated_at: '2026-10-09T02:00:00.000Z',
          },
        ],
        count: 1,
        error: null,
      }),
    }

    let selectTasksCallCount = 0
    const tasksRootBuilder: any = {
      select: vi.fn().mockImplementation((_fields: string, options?: any) => {
        selectTasksCallCount++
        if (options && options.count === 'exact') {
          return inProgressBuilder
        }
        if (selectTasksCallCount === 1) {
          return incompleteBuilder
        }
        return completedBuilder
      }),
    }

    const scheduleQueryBuilder: any = {
      select: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'block-1',
            user_id: 'user-1',
            task_id: 'task-1',
            title: 'Focus block',
            start_at: '2026-10-09T08:00:00.000Z',
            end_at: '2026-10-09T09:00:00.000Z',
            created_at: '2026-10-09T00:00:00.000Z',
            updated_at: '2026-10-09T00:00:00.000Z',
            tasks: {
              id: 'task-1',
              user_id: 'user-1',
              title: 'Incomplete Task',
              status: 'todo',
              priority: 'high',
              due_date_kind: 'date_time',
              due_at: '2026-10-09T08:00:00.000Z',
              created_at: '2026-10-01T00:00:00.000Z',
              updated_at: '2026-10-01T00:00:00.000Z',
            },
          },
        ],
        error: null,
      }),
    }

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'tasks') return tasksRootBuilder
      if (table === 'schedule_blocks') return scheduleQueryBuilder
      return {} as any
    })

    const snapshot = await fetchDashboardSnapshot({
      timeZone: 'Asia/Ho_Chi_Minh',
      now: new Date('2026-10-09T10:00:00.000Z'),
    })

    expect(supabase.from).toHaveBeenCalledWith('tasks')
    expect(supabase.from).toHaveBeenCalledWith('schedule_blocks')
    expect(snapshot.metrics.relevantCount).toBe(2)
    expect(snapshot.metrics.completedCount).toBe(1)
    expect(snapshot.metrics.remainingCount).toBe(1)
    expect(snapshot.metrics.completionPercentage).toBe(50)
    expect(snapshot.todaySchedule.length).toBe(1)
    expect(snapshot.todaySchedule[0]?.taskTitle).toBe('Incomplete Task')
    expect(snapshot.inProgressTasks.length).toBe(1)
    expect(snapshot.inProgressTasks[0]?.id).toBe('task-3')
    expect(snapshot.inProgressTotal).toBe(1)
  })

  it('throws when task query errors', async () => {
    const errorQueryBuilder: any = {
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      order: vi.fn().mockImplementation(() => {
        const promiseOrBuilder: any = Promise.resolve({
          data: null,
          error: { message: 'Database connection failed' },
        })
        promiseOrBuilder.order = vi.fn().mockReturnValue(promiseOrBuilder)
        promiseOrBuilder.limit = vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' },
        })
        return promiseOrBuilder
      }),
    }

    vi.mocked(supabase.from).mockImplementation(() => errorQueryBuilder)

    await expect(
      fetchDashboardSnapshot({
        timeZone: 'Asia/Ho_Chi_Minh',
        now: new Date('2026-10-09T10:00:00.000Z'),
      })
    ).rejects.toThrow('Database connection failed')
  })
})

describe('paged dashboard query functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchInProgressTasksPaged applies pagination range and returns mapped tasks', async () => {
    const { fetchInProgressTasksPaged } = await import('../api/dashboard')
    const queryBuilder: any = {
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'task-prog-1',
            user_id: 'user-1',
            title: 'In Progress Task 1',
            status: 'in_progress',
            priority: 'high',
            due_date_kind: 'date_time',
            created_at: '2026-10-01T00:00:00.000Z',
            updated_at: '2026-10-09T00:00:00.000Z',
          },
        ],
        count: 10,
        error: null,
      }),
    }

    vi.mocked(supabase.from).mockReturnValue(queryBuilder)

    const res = await fetchInProgressTasksPaged({ page: 2, pageSize: 5 })

    expect(queryBuilder.range).toHaveBeenCalledWith(5, 9)
    expect(res.items.length).toBe(1)
    expect(res.items[0]?.id).toBe('task-prog-1')
    expect(res.total).toBe(10)
    expect(res.hasMore).toBe(true)
  })

  it('fetchPriorityTasksPaged orders by priority_rank desc and returns paged results', async () => {
    const { fetchPriorityTasksPaged } = await import('../api/dashboard')
    const queryBuilder: any = {
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'task-prio-1',
            user_id: 'user-1',
            title: 'Priority Task 1',
            status: 'todo',
            priority: 'high',
            priority_rank: 3,
            due_date_kind: 'date_time',
            created_at: '2026-10-01T00:00:00.000Z',
            updated_at: '2026-10-09T00:00:00.000Z',
          },
        ],
        count: 1,
        error: null,
      }),
    }

    vi.mocked(supabase.from).mockReturnValue(queryBuilder)

    const res = await fetchPriorityTasksPaged({ page: 1, pageSize: 5 })

    expect(queryBuilder.range).toHaveBeenCalledWith(0, 4)
    expect(res.items[0]?.title).toBe('Priority Task 1')
    expect(res.hasMore).toBe(false)
  })

  it('fetchTodaySchedulePaged applies today date window and joins task', async () => {
    const { fetchTodaySchedulePaged } = await import('../api/dashboard')
    const queryBuilder: any = {
      select: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'block-1',
            user_id: 'user-1',
            task_id: 'task-1',
            title: 'Block 1',
            start_at: '2026-10-09T08:00:00.000Z',
            end_at: '2026-10-09T09:00:00.000Z',
            created_at: '2026-10-09T00:00:00.000Z',
            updated_at: '2026-10-09T00:00:00.000Z',
            tasks: {
              id: 'task-1',
              user_id: 'user-1',
              title: 'Linked Task',
              status: 'in_progress',
              priority: 'high',
              due_date_kind: 'date_time',
              created_at: '2026-10-01T00:00:00.000Z',
              updated_at: '2026-10-01T00:00:00.000Z',
            },
          },
        ],
        count: 3,
        error: null,
      }),
    }

    vi.mocked(supabase.from).mockReturnValue(queryBuilder)

    const res = await fetchTodaySchedulePaged({
      page: 1,
      pageSize: 5,
      timeZone: 'Asia/Ho_Chi_Minh',
      now: new Date('2026-10-09T10:00:00.000Z'),
    })

    expect(queryBuilder.range).toHaveBeenCalledWith(0, 4)
    expect(res.items[0]?.title).toBe('Block 1')
    expect(res.items[0]?.taskTitle).toBe('Linked Task')
    expect(res.items[0]?.taskStatus).toBe('in_progress')
  })

  it('fetchUpcomingDeadlinesPaged applies next 7 days window and returns paged results', async () => {
    const { fetchUpcomingDeadlinesPaged } = await import('../api/dashboard')
    const queryBuilder: any = {
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'upcoming-1',
            user_id: 'user-1',
            title: 'Upcoming Task 1',
            status: 'todo',
            priority: 'medium',
            due_date_kind: 'date_time',
            due_at: '2026-10-12T10:00:00.000Z',
            created_at: '2026-10-01T00:00:00.000Z',
            updated_at: '2026-10-01T00:00:00.000Z',
          },
        ],
        count: 1,
        error: null,
      }),
    }

    vi.mocked(supabase.from).mockReturnValue(queryBuilder)

    const res = await fetchUpcomingDeadlinesPaged({
      page: 1,
      pageSize: 5,
      timeZone: 'Asia/Ho_Chi_Minh',
      now: new Date('2026-10-09T10:00:00.000Z'),
    })

    expect(queryBuilder.range).toHaveBeenCalledWith(0, 4)
    expect(res.items[0]?.id).toBe('upcoming-1')
  })
})
