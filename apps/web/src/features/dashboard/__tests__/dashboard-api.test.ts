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

  it('runs three queries with correct predicates and maps snapshot', async () => {
    const tasksQueryBuilder: any = {
      select: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn(),
    }

    // Call 1: incomplete tasks
    // Call 2: completed today tasks
    tasksQueryBuilder.order
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
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
      })

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
      if (table === 'tasks') return tasksQueryBuilder
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
  })

  it('throws when task query errors', async () => {
    const errorQueryBuilder: any = {
      select: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
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
