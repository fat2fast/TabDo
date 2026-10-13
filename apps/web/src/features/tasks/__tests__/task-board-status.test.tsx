import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskBoard } from '../components/task-board'
import type { TaskViewSearchParams } from '../hooks/use-task-view-search-params'
import type { Task } from '../types'
import { useTaskBoardLane } from '../hooks/use-tasks'
import { useTaskMutations } from '../hooks/use-task-mutations'
import { useConfirm } from '../../../components/ui'

// Mock dependencies
vi.mock('../../auth/auth-provider', () => ({
  useAuth: () => ({ profile: { timezone: 'Asia/Ho_Chi_Minh' } }),
  useOptionalAuth: () => ({ profile: { timezone: 'Asia/Ho_Chi_Minh' } }),
}))

vi.mock('../../i18n/i18n-provider', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'tasks.laneTodo': 'Cần làm',
        'tasks.laneInProgress': 'Đang làm',
        'tasks.laneDone': 'Hoàn thành',
        'tasks.laneEmpty': 'Không có công việc nào trong cột này',
        'tasks.statusChangeBlockedRecurrenceTitle': 'Không thể mở lại công việc',
        'tasks.statusChangeBlockedRecurrence': 'Không thể mở lại công việc lặp lại vì đã có lượt tiếp theo được tạo.',
      }
      return map[key] || key
    },
  }),
}))

vi.mock('../hooks/use-categories', () => ({
  useCategories: () => ({ data: [] }),
}))

vi.mock('../hooks/use-tasks', () => ({
  useTaskBoardLane: vi.fn(),
}))

vi.mock('../hooks/use-task-mutations', () => ({
  useTaskMutations: vi.fn(),
}))

vi.mock('../../../components/ui', () => ({
  useConfirm: vi.fn(),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('TaskBoard status interactions and drag-and-drop', () => {
  const mockMutate = vi.fn()
  const mockConfirm = vi.fn()

  const mockTaskTodo: Task = {
    id: 'task-101',
    title: 'Interactive Board Card',
    status: 'todo',
    priority: 'high',
    categoryId: null,
    dueDateKind: 'date_only',
    startAt: null,
    dueAt: null,
    sourceUrl: null,
    completedAt: null,
    recurrenceRule: null,
    createdAt: '2026-10-13T00:00:00Z',
    updatedAt: '2026-10-13T00:00:00Z',
    userId: 'user-1',
  }

  const defaultParams: TaskViewSearchParams = {
    search: '',
    status: undefined,
    priority: undefined,
    categoryId: undefined,
    dueFrom: undefined,
    dueTo: undefined,
    completedRange: undefined,
    completedFrom: undefined,
    completedTo: undefined,
    sort: 'default',
    scope: undefined,
    layout: 'board',
  }

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useConfirm).mockReturnValue(mockConfirm)

    vi.mocked(useTaskMutations).mockReturnValue({
      changeTaskStatusMutation: {
        mutate: mockMutate,
        isPending: false,
      },
    } as any)

    vi.mocked(useTaskBoardLane).mockImplementation((input: any) => {
      if (input.lane === 'todo') {
        return {
          data: {
            pages: [
              {
                lane: 'todo',
                items: [mockTaskTodo],
                total: 1,
                hasMore: false,
                page: 1,
              },
            ],
          },
          isLoading: false,
          hasNextPage: false,
        } as any
      }
      return {
        data: {
          pages: [
            {
              lane: input.lane,
              items: [],
              total: 0,
              hasMore: false,
              page: 1,
            },
          ],
        },
        isLoading: false,
        hasNextPage: false,
      } as any
    })
  })

  it('triggers changeTaskStatusMutation on desktop drag-and-drop across lanes', () => {
    render(
      <TaskBoard
        currentView="inbox"
        params={defaultParams}
        onSelectTask={vi.fn()}
        now={new Date()}
      />,
      { wrapper: createWrapper() }
    )

    const inProgressLane = screen.getByTestId('task-board-lane-in_progress')

    // Simulate drag and drop into in_progress lane
    const dataTransfer = {
      data: {
        'text/plain': 'task-101',
        'application/json': JSON.stringify(mockTaskTodo),
      },
      getData: (format: string) => (dataTransfer.data as any)[format],
      setData: vi.fn(),
      dropEffect: 'none',
    }

    fireEvent.dragOver(inProgressLane, { dataTransfer })
    fireEvent.drop(inProgressLane, { dataTransfer })

    expect(mockMutate).toHaveBeenCalledTimes(1)
    expect(mockMutate).toHaveBeenCalledWith(
      {
        task: mockTaskTodo,
        targetStatus: 'in_progress',
        boardOrder: expect.any(Number),
      },
      expect.any(Object)
    )
  })

  it('renders card title, metadata and allows selecting card', async () => {
    const user = userEvent.setup()
    const mockSelect = vi.fn()

    render(
      <TaskBoard
        currentView="inbox"
        params={defaultParams}
        onSelectTask={mockSelect}
        now={new Date()}
      />,
      { wrapper: createWrapper() }
    )

    const card = screen.getByTestId('task-board-card-task-101')
    expect(card).toBeInTheDocument()
    expect(within(card).getByText('Interactive Board Card')).toBeInTheDocument()

    await user.click(card)
    expect(mockSelect).toHaveBeenCalledWith('task-101')
  })

  it('ignores drop onto the same lane (no-op)', () => {
    render(
      <TaskBoard
        currentView="inbox"
        params={defaultParams}
        onSelectTask={vi.fn()}
        now={new Date()}
      />,
      { wrapper: createWrapper() }
    )

    const todoLane = screen.getByTestId('task-board-lane-todo')

    const dataTransfer = {
      data: {
        'text/plain': 'task-101',
        'application/json': JSON.stringify({ id: 'task-101', status: 'todo' }),
      },
      getData: (format: string) => (dataTransfer.data as any)[format],
      setData: vi.fn(),
      dropEffect: 'none',
    }

    fireEvent.dragOver(todoLane, { dataTransfer })
    fireEvent.drop(todoLane, { dataTransfer })

    // Must NOT call mutate for same lane
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('shows warning alert dialog when reopening recurring task that already has successor', async () => {
    // Setup mutation to trigger onError callback with recurring successor message
    mockMutate.mockImplementation((_vars: any, options: any) => {
      options.onError(new Error('RECURRING_TASK_HAS_SUCCESSOR: Không thể mở lại công việc lặp lại đã có phiên lặp tiếp theo'))
    })

    render(
      <TaskBoard
        currentView="inbox"
        params={defaultParams}
        onSelectTask={vi.fn()}
        now={new Date()}
      />,
      { wrapper: createWrapper() }
    )

    const inProgressLane = screen.getByTestId('task-board-lane-in_progress')
    const dataTransfer = {
      data: {
        'text/plain': 'task-101',
        'application/json': JSON.stringify(mockTaskTodo),
      },
      getData: (format: string) => (dataTransfer.data as any)[format],
      setData: vi.fn(),
      dropEffect: 'none',
    }

    fireEvent.dragOver(inProgressLane, { dataTransfer })
    fireEvent.drop(inProgressLane, { dataTransfer })

    expect(mockConfirm).toHaveBeenCalledTimes(1)
    expect(mockConfirm).toHaveBeenCalledWith({
      title: 'Không thể mở lại công việc',
      message: 'Không thể mở lại công việc lặp lại vì đã có lượt tiếp theo được tạo.',
      confirmText: 'Đã hiểu',
      cancelText: null,
      variant: 'warning',
    })
  })
})
