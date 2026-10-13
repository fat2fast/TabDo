import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTaskBoardLane, changeTaskStatus } from '../api/tasks'
import type { Task, TaskBoardLaneQueryInput } from '../types'
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

describe('getTaskBoardLane', () => {
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

  it('queries Supabase with exact count and pagination range', async () => {
    const mockTasks = Array.from({ length: 30 }, (_, i) => ({
      id: `task-${i + 1}`,
      title: `Task ${i + 1}`,
      status: 'todo',
      user_id: 'test-user-id-123',
    }))

    const mockQueryBuilder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: mockTasks,
        count: 105,
        error: null,
      }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockQueryBuilder)

    const input: TaskBoardLaneQueryInput = {
      lane: 'todo',
      view: 'inbox',
      page: 1,
      pageSize: 30,
      timeZone: 'Asia/Ho_Chi_Minh',
      now: new Date('2026-10-13T10:00:00Z'),
    }

    const result = await getTaskBoardLane(input)

    expect(supabase.from).toHaveBeenCalledWith('tasks')
    expect(mockQueryBuilder.select).toHaveBeenCalledWith('*', { count: 'exact' })
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('status', 'todo')
    expect(mockQueryBuilder.range).toHaveBeenCalledWith(0, 29)
    // Order includes tie-breaker
    expect(mockQueryBuilder.order).toHaveBeenCalledWith('id', { ascending: true })

    expect(result.lane).toBe('todo')
    expect(result.total).toBe(105)
    expect(result.hasMore).toBe(true)
    expect(result.page).toBe(1)
    expect(result.items).toHaveLength(30)
    expect(result.items[0].id).toBe('task-1')
    expect(result.items[0].title).toBe('Task 1')
    expect(result.items[0].userId).toBe('test-user-id-123')
  })


  it('short-circuits when status filter conflicts with lane', async () => {
    const input: TaskBoardLaneQueryInput = {
      lane: 'todo',
      status: 'done', // User filtered by 'done', but this is 'todo' lane
      view: 'inbox',
      page: 1,
      pageSize: 30,
      timeZone: 'Asia/Ho_Chi_Minh',
      now: new Date('2026-10-13T10:00:00Z'),
    }

    const result = await getTaskBoardLane(input)

    expect(supabase.from).not.toHaveBeenCalled()
    expect(result).toEqual({
      lane: 'todo',
      items: [],
      total: 0,
      hasMore: false,
      page: 1,
    })
  })

  it('short-circuits when completed view is queried for non-done lane', async () => {
    const input: TaskBoardLaneQueryInput = {
      lane: 'in_progress',
      view: 'completed',
      page: 1,
      pageSize: 30,
      timeZone: 'Asia/Ho_Chi_Minh',
      now: new Date('2026-10-13T10:00:00Z'),
    }

    const result = await getTaskBoardLane(input)

    expect(supabase.from).not.toHaveBeenCalled()
    expect(result).toEqual({
      lane: 'in_progress',
      items: [],
      total: 0,
      hasMore: false,
      page: 1,
    })
  })

  it('supports pagination over >100 fixture items across multiple pages', async () => {
    // Generate 110 items
    const allItems = Array.from({ length: 110 }, (_, i) => ({
      id: `task-${String(i + 1).padStart(3, '0')}`,
      title: `Task ${i + 1}`,
      status: 'in_progress',
      user_id: 'test-user-id-123',
    }))

    const createMockBuilder = (from: number, to: number) => {
      const slice = allItems.slice(from, to + 1)
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: slice,
          count: allItems.length,
          error: null,
        }),
      }
    }

    const collectedItems: any[] = []
    const pageSize = 30
    let currentPage = 1
    let hasMore = true

    while (hasMore) {
      const from = (currentPage - 1) * pageSize
      const to = from + pageSize - 1
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder(from, to) as any)

      const result = await getTaskBoardLane({
        lane: 'in_progress',
        view: 'inbox',
        page: currentPage,
        pageSize,
        timeZone: 'Asia/Ho_Chi_Minh',
        now: new Date('2026-10-13T10:00:00Z'),
      })

      collectedItems.push(...result.items)
      hasMore = result.hasMore
      currentPage = result.page + 1
    }

    expect(collectedItems).toHaveLength(110)
    expect(collectedItems.map((t) => t.id)).toEqual(allItems.map((t) => t.id))
    // No duplicates or skips
    const uniqueIds = new Set(collectedItems.map((t) => t.id))
    expect(uniqueIds.size).toBe(110)
  })

  it('includes scheduled-only tasks without due_at in today board view', async () => {
    const mockTasks = [
      {
        id: 'scheduled-task-1',
        title: 'Task without due date scheduled today',
        status: 'todo',
        user_id: 'test-user-id-123',
        due_at: null,
      },
    ]

    const scheduleBlocksBuilder: any = {
      select: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gt: vi.fn().mockResolvedValue({
        data: [{ task_id: 'scheduled-task-1' }],
        error: null,
      }),
    }

    const tasksQueryBuilder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: mockTasks,
        count: 1,
        error: null,
      }),
    }

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'schedule_blocks') return scheduleBlocksBuilder
      return tasksQueryBuilder
    })

    const input: TaskBoardLaneQueryInput = {
      lane: 'todo',
      view: 'today',
      page: 1,
      pageSize: 30,
      timeZone: 'Asia/Ho_Chi_Minh',
      now: new Date('2026-10-13T10:00:00Z'),
    }

    const result = await getTaskBoardLane(input)

    expect(supabase.from).toHaveBeenCalledWith('schedule_blocks')
    expect(tasksQueryBuilder.or).toHaveBeenCalledWith(
      expect.stringContaining('id.in.(scheduled-task-1)')
    )
    expect(result.items).toHaveLength(1)
    expect(result.items[0].id).toBe('scheduled-task-1')
  })
})

describe('changeTaskStatus board order resilience', () => {
  it('returns completed task even if secondary board_order update fails', async () => {
    const activeTask: Task = {
      id: 'task-100',
      userId: 'test-user-id-123',
      title: 'Finish report',
      description: null,
      status: 'in_progress',
      priority: 'high',
      dueAt: null,
      dueDateKind: 'date_only',
      completedAt: null,
      boardOrder: 1,
      createdAt: '2026-10-13T00:00:00Z',
      updatedAt: '2026-10-13T00:00:00Z',
      deletedAt: null,
      deletionBatchId: null,
      recurrenceRule: null,
      recurrenceSeriesId: null,
      recurrenceParentId: null,
      recurrenceTimezone: null,
      recurrenceAnchorAt: null,
    }

    const completedRow = {
      id: 'task-100',
      user_id: 'test-user-id-123',
      title: 'Finish report',
      status: 'done',
      completed_at: '2026-10-13T12:00:00Z',
      updated_at: '2026-10-13T12:00:00Z',
    }

    // completeTask RPC succeeds
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        completedTask: completedRow,
        nextTask: null,
        generated: false,
        reusedExistingSuccessor: false,
      },
      error: null,
    } as any)

    // updateTask for board_order fails
    const updateQueryBuilder: any = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection glitch during board reorder' },
      }),
    }
    vi.mocked(supabase.from).mockReturnValue(updateQueryBuilder)

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await changeTaskStatus(activeTask, 'done', 10)

    expect(result.status).toBe('done')
    expect(result.id).toBe('task-100')
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to update board_order'),
      expect.anything()
    )
    warnSpy.mockRestore()
  })
})
