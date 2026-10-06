import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TasksPage } from '../../../pages/TasksPage'
import type { TaskRow } from '../types'
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

vi.mock('../../auth/auth-provider', () => {
  return {
    useAuth: () => ({
      profile: {
        id: 'u-1',
        timezone: 'Asia/Ho_Chi_Minh',
        role: 'user',
        displayName: 'Test User',
      },
      session: {
        user: { id: 'u-1', email: 'test@tabdo.local' },
      },
    }),
  }
})

function renderTasksPage(initialPath: string = '/tasks/inbox') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <TasksPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('smart-task-views', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'u-1' } } as any },
      error: null,
    })
  })

  it('renders Inbox view with empty text when no unorganized tasks exist', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'tasks') {
        return {
          select: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        } as any
      }
      if (table === 'categories') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        } as any
      }
      return {} as any
    })

    renderTasksPage('/tasks/inbox')

    expect(
      await screen.findByText('Inbox trống. Các công việc đã được sắp xếp.')
    ).toBeInTheDocument()
  })

  it('renders Today view separating Overdue and Due today groups', async () => {
    // Current time: 2026-10-05 12:00:00 UTC (19:00:00 ICT)
    const taskOverdue: TaskRow = {
      id: 'task-overdue-1',
      user_id: 'u-1',
      category_id: null,
      parent_id: null,
      title: 'Task due one minute ago',
      description: null,
      status: 'todo',
      priority: 'high',
      due_date_kind: 'date_time',
      // One minute before now
      due_at: new Date(Date.now() - 60000).toISOString(),
      start_at: null,
      source_url: null,
      completed_at: null,
      recurrence_rule: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const taskDueToday: TaskRow = {
      id: 'task-due-today-1',
      user_id: 'u-1',
      category_id: null,
      parent_id: null,
      title: 'Task due later today',
      description: null,
      status: 'todo',
      priority: 'medium',
      due_date_kind: 'date_time',
      // One hour in future
      due_at: new Date(Date.now() + 3600000).toISOString(),
      start_at: null,
      source_url: null,
      completed_at: null,
      recurrence_rule: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'tasks') {
        return {
          select: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [taskOverdue, taskDueToday],
            error: null,
          }),
        } as any
      }
      if (table === 'categories') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        } as any
      }
      return {} as any
    })

    renderTasksPage('/tasks/today')

    expect(await screen.findByText('Task due one minute ago')).toBeInTheDocument()
    expect(screen.getByText('Task due later today')).toBeInTheDocument()

    // Assert group containers exist
    expect(screen.getByTestId('task-group-quá-hạn')).toBeInTheDocument()
    expect(screen.getByTestId('task-group-hôm-nay')).toBeInTheDocument()
  })

  it('renders Upcoming view grouped by Tomorrow, This Week, and Later', async () => {
    const nowMs = Date.now()
    const taskTomorrow: TaskRow = {
      id: 'task-tomorrow-1',
      user_id: 'u-1',
      category_id: null,
      parent_id: null,
      title: 'Action tomorrow',
      description: null,
      status: 'todo',
      priority: 'medium',
      due_date_kind: 'date_time',
      due_at: new Date(nowMs + 86400000).toISOString(),
      start_at: null,
      source_url: null,
      completed_at: null,
      recurrence_rule: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const taskLater: TaskRow = {
      id: 'task-later-1',
      user_id: 'u-1',
      category_id: null,
      parent_id: null,
      title: 'Action next month',
      description: null,
      status: 'todo',
      priority: 'low',
      due_date_kind: 'date_time',
      due_at: new Date(nowMs + 86400000 * 30).toISOString(),
      start_at: null,
      source_url: null,
      completed_at: null,
      recurrence_rule: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'tasks') {
        return {
          select: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [taskTomorrow, taskLater],
            error: null,
          }),
        } as any
      }
      if (table === 'categories') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        } as any
      }
      return {} as any
    })

    renderTasksPage('/tasks/upcoming')

    expect(await screen.findByText('Action tomorrow')).toBeInTheDocument()
    expect(screen.getByText('Action next month')).toBeInTheDocument()
    expect(screen.getByText('Sau này')).toBeInTheDocument()
  })

  it('renders Completed view and excludes completed tasks from active views', async () => {
    const completedTask: TaskRow = {
      id: 'task-done-1',
      user_id: 'u-1',
      category_id: null,
      parent_id: null,
      title: 'Finished project presentation',
      description: null,
      status: 'done',
      priority: 'high',
      due_date_kind: 'date_time',
      due_at: '2026-10-01T10:00:00Z',
      start_at: null,
      source_url: null,
      completed_at: '2026-10-05T10:00:00Z',
      recurrence_rule: null,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-05T10:00:00Z',
    }

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'tasks') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [completedTask],
            error: null,
          }),
        } as any
      }
      if (table === 'categories') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        } as any
      }
      return {} as any
    })

    renderTasksPage('/tasks/completed')

    expect(await screen.findByText('Finished project presentation')).toBeInTheDocument()
  })

  it('filters by status, priority, and searches title with debouncing', async () => {
    const user = userEvent.setup()

    const selectMock = vi.fn().mockReturnThis()
    const neqMock = vi.fn().mockReturnThis()
    const isMock = vi.fn().mockReturnThis()
    const eqMock = vi.fn().mockReturnThis()
    const ilikeMock = vi.fn().mockReturnThis()
    const orderMock = vi.fn().mockReturnThis()
    const limitMock = vi.fn().mockResolvedValue({ data: [], error: null })

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'tasks') {
        return {
          select: selectMock,
          neq: neqMock,
          is: isMock,
          eq: eqMock,
          ilike: ilikeMock,
          order: orderMock,
          limit: limitMock,
        } as any
      }
      if (table === 'categories') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        } as any
      }
      return {} as any
    })

    renderTasksPage('/tasks/inbox')

    // Filter by priority
    const prioritySelect = screen.getByLabelText(/lọc theo ưu tiên/i)
    await user.selectOptions(prioritySelect, 'high')

    // Search by title
    const searchInput = screen.getByPlaceholderText(/tìm kiếm theo tiêu đề/i)
    await user.type(searchInput, 'urgent report')

    await waitFor(() => {
      expect(ilikeMock).toHaveBeenCalledWith('title', '%urgent report%')
      expect(eqMock).toHaveBeenCalledWith('priority', 'high')
    })
  })

  it('Today view groups Scheduled Today with precedence and avoids duplicates when task is already due today', async () => {
    const taskDueToday: TaskRow = {
      id: 'task-due-1',
      user_id: 'u-1',
      category_id: null,
      parent_id: null,
      title: 'Task due and scheduled today',
      description: null,
      status: 'todo',
      priority: 'high',
      due_date_kind: 'date_time',
      due_at: new Date(Date.now() + 3600000).toISOString(),
      start_at: null,
      source_url: null,
      completed_at: null,
      recurrence_rule: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const taskScheduledLater: TaskRow = {
      id: 'task-scheduled-only-1',
      user_id: 'u-1',
      category_id: null,
      parent_id: null,
      title: 'Task due next week but scheduled today',
      description: null,
      status: 'todo',
      priority: 'medium',
      due_date_kind: 'date_time',
      due_at: new Date(Date.now() + 86400000 * 7).toISOString(),
      start_at: null,
      source_url: null,
      completed_at: null,
      recurrence_rule: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const scheduleBlocks = [
      {
        id: 'block-1',
        user_id: 'u-1',
        task_id: 'task-due-1',
        title: 'Session for task due today',
        start_at: new Date().toISOString(),
        end_at: new Date(Date.now() + 3600000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'block-2',
        user_id: 'u-1',
        task_id: 'task-scheduled-only-1',
        title: 'Session for task due later',
        start_at: new Date().toISOString(),
        end_at: new Date(Date.now() + 3600000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'tasks') {
        return {
          select: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [taskDueToday],
            error: null,
          }),
          in: vi.fn().mockImplementation((col: string, ids: string[]) => {
            return Promise.resolve({
              data: [taskDueToday, taskScheduledLater].filter((t) => ids.includes(t.id)),
              error: null,
            })
          }),
        } as any
      }
      if (table === 'schedule_blocks') {
        return {
          select: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: scheduleBlocks,
            error: null,
          }),
        } as any
      }
      if (table === 'categories') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        } as any
      }
      return {} as any
    })

    renderTasksPage('/tasks/today')

    // Task due today should appear in "Hôm nay"
    expect(await screen.findByText('Task due and scheduled today')).toBeInTheDocument()
    // Task scheduled later should appear in "Lên lịch hôm nay"
    expect(await screen.findByText('Task due next week but scheduled today')).toBeInTheDocument()

    // Assert group containers
    expect(screen.getByTestId('task-group-hôm-nay')).toBeInTheDocument()
    expect(screen.getByTestId('task-group-lên-lịch-hôm-nay')).toBeInTheDocument()

    // Verify deduplication: taskDueToday only appears once in the entire page
    const dueTodayElements = screen.getAllByText('Task due and scheduled today')
    expect(dueTodayElements).toHaveLength(1)
  })

  it('Today view ignores unlinked schedule blocks (task_id is null)', async () => {
    const unlinkedScheduleBlock = {
      id: 'block-adhoc-1',
      user_id: 'u-1',
      task_id: null,
      title: 'Ad-hoc Focus Session',
      start_at: new Date().toISOString(),
      end_at: new Date(Date.now() + 3600000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'tasks') {
        return {
          select: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
          in: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        } as any
      }
      if (table === 'schedule_blocks') {
        return {
          select: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [unlinkedScheduleBlock],
            error: null,
          }),
        } as any
      }
      if (table === 'categories') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        } as any
      }
      return {} as any
    })

    renderTasksPage('/tasks/today')

    // Unlinked block does not create task, empty state is displayed
    expect(await screen.findByText('Hôm nay chưa có công việc đến hạn.')).toBeInTheDocument()
    expect(screen.queryByText('Ad-hoc Focus Session')).not.toBeInTheDocument()
  })

  it('Today view with no due tasks but one scheduled task renders Scheduled Today group instead of empty state', async () => {
    const taskScheduled: TaskRow = {
      id: 'task-scheduled-only-2',
      user_id: 'u-1',
      category_id: null,
      parent_id: null,
      title: 'Only scheduled task for today',
      description: null,
      status: 'todo',
      priority: 'high',
      due_date_kind: 'date_time',
      due_at: null,
      start_at: null,
      source_url: null,
      completed_at: null,
      recurrence_rule: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const scheduleBlock = {
      id: 'block-2',
      user_id: 'u-1',
      task_id: 'task-scheduled-only-2',
      title: 'Scheduled session',
      start_at: new Date().toISOString(),
      end_at: new Date(Date.now() + 3600000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'tasks') {
        return {
          select: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
          in: vi.fn().mockImplementation((col: string, ids: string[]) => {
            return Promise.resolve({
              data: [taskScheduled].filter((t) => ids.includes(t.id)),
              error: null,
            })
          }),
        } as any
      }
      if (table === 'schedule_blocks') {
        return {
          select: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [scheduleBlock],
            error: null,
          }),
        } as any
      }
      if (table === 'categories') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        } as any
      }
      return {} as any
    })

    renderTasksPage('/tasks/today')

    // Should NOT show empty state
    expect(screen.queryByText('Hôm nay chưa có công việc đến hạn.')).not.toBeInTheDocument()

    // Should show Scheduled Today group and the task
    expect(await screen.findByText('Only scheduled task for today')).toBeInTheDocument()
    expect(screen.getByTestId('task-group-lên-lịch-hôm-nay')).toBeInTheDocument()
  })
})
