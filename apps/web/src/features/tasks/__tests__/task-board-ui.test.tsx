import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskBoard } from '../components/task-board'
import type { TaskViewSearchParams } from '../hooks/use-task-view-search-params'
import type { Task } from '../types'
import { useTaskBoardLane } from '../hooks/use-tasks'
import { useCategories } from '../hooks/use-categories'

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
        'tasks.loadMore': 'Tải thêm',
        'tasks.loadingMore': 'Đang tải...',
        'common.loading': 'Đang tải...',
        'common.retry': 'Thử lại',
      }
      return map[key] || key
    },
  }),
}))

vi.mock('../hooks/use-categories', () => ({
  useCategories: vi.fn(),
}))

vi.mock('../hooks/use-tasks', () => ({
  useTaskBoardLane: vi.fn(),
}))

const mockCreateTaskMutateAsync = vi.fn().mockResolvedValue({ id: 'new-task' })
const mockChangeTaskStatusMutate = vi.fn()
vi.mock('../hooks/use-task-mutations', () => ({
  useTaskMutations: () => ({
    changeTaskStatusMutation: {
      mutate: mockChangeTaskStatusMutate,
      isPending: false,
    },
    createTaskMutation: {
      mutateAsync: mockCreateTaskMutateAsync,
      isPending: false,
    },
  }),
}))

vi.mock('../../../components/ui', () => ({
  useConfirm: () => vi.fn(),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('TaskBoard UI', () => {
  const mockCategories = [
    { id: 'cat-work', name: 'Công việc', color: '#3b82f6' },
  ]

  const mockTasksTodo: Task[] = [
    {
      id: 'task-1',
      title: 'Design Kanban Board',
      status: 'todo',
      priority: 'high',
      categoryId: 'cat-work',
      dueDateKind: 'date_only',
      startAt: null,
      dueAt: null,
      sourceUrl: null,
      completedAt: null,
      recurrenceRule: null,
      description: '- [x] Step 1\n- [ ] Step 2',
      createdAt: '2026-10-13T00:00:00Z',
      updatedAt: '2026-10-13T00:00:00Z',
      userId: 'user-1',
    },
  ]

  const mockTasksInProgress: Task[] = [
    {
      id: 'task-2',
      title: 'Implement drag and drop',
      status: 'in_progress',
      priority: 'medium',
      categoryId: null,
      dueDateKind: 'date_only',
      startAt: null,
      dueAt: '2026-10-15T17:00:00Z',
      sourceUrl: null,
      completedAt: null,
      recurrenceRule: 'FREQ=DAILY',
      description: 'Recurring task implementation',
      createdAt: '2026-10-13T00:00:00Z',
      updatedAt: '2026-10-13T00:00:00Z',
      userId: 'user-1',
    },
  ]


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
    vi.mocked(useCategories).mockReturnValue({ data: mockCategories } as any)

    vi.mocked(useTaskBoardLane).mockImplementation((input: any) => {
      if (input.lane === 'todo') {
        return {
          data: {
            pages: [
              {
                lane: 'todo',
                items: mockTasksTodo,
                total: 10,
                hasMore: true,
                page: 1,
              },
            ],
          },
          isLoading: false,
          isError: false,
          fetchNextPage: vi.fn(),
          hasNextPage: true,
          isFetchingNextPage: false,
        } as any
      }
      if (input.lane === 'in_progress') {
        return {
          data: {
            pages: [
              {
                lane: 'in_progress',
                items: mockTasksInProgress,
                total: 1,
                hasMore: false,
                page: 1,
              },
            ],
          },
          isLoading: false,
          isError: false,
          fetchNextPage: vi.fn(),
          hasNextPage: false,
          isFetchingNextPage: false,
        } as any
      }
      return {
        data: {
          pages: [
            {
              lane: 'done',
              items: [],
              total: 0,
              hasMore: false,
              page: 1,
            },
          ],
        },
        isLoading: false,
        isError: false,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
      } as any
    })
  })

  it('renders all 3 lanes with correct titles and count badges', () => {
    render(
      <TaskBoard
        currentView="inbox"
        params={defaultParams}
        onSelectTask={vi.fn()}
        now={new Date()}
      />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByRole('heading', { name: 'Cần làm' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Đang làm' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hoàn thành' })).toBeInTheDocument()

    // Count badges: 10 for todo, 1 for in_progress, 0 for done
    expect(screen.getByLabelText('10 công việc')).toBeInTheDocument()
    expect(screen.getByLabelText('1 công việc')).toBeInTheDocument()
    expect(screen.getByLabelText('0 công việc')).toBeInTheDocument()
    expect(screen.getByTestId('lane-count-todo')).toHaveTextContent('10')
    expect(screen.getByTestId('lane-count-in_progress')).toHaveTextContent('1')
    expect(screen.getByTestId('lane-count-done')).toHaveTextContent('0')
  })

  it('renders task cards with metadata badges and handles click to select', async () => {
    const user = userEvent.setup()
    const handleSelectTask = vi.fn()

    render(
      <TaskBoard
        currentView="inbox"
        params={defaultParams}
        onSelectTask={handleSelectTask}
        now={new Date()}
      />,
      { wrapper: createWrapper() }
    )

    // Task 1 title & category badge
    expect(screen.getByText('Design Kanban Board')).toBeInTheDocument()
    expect(screen.getByText('Công việc')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument() // Checklist badge

    // Task 2 title & recurrence badge
    expect(screen.getByText('Implement drag and drop')).toBeInTheDocument()
    expect(screen.getByText('Hàng ngày')).toBeInTheDocument() // Recurrence summary

    // Click card opens drawer via onSelectTask
    const card = screen.getByTestId('task-board-card-task-1')
    await user.click(card)
    expect(handleSelectTask).toHaveBeenCalledWith('task-1')
  })

  it('renders empty lane message when lane has no tasks', () => {
    render(
      <TaskBoard
        currentView="inbox"
        params={defaultParams}
        onSelectTask={vi.fn()}
        now={new Date()}
      />,
      { wrapper: createWrapper() }
    )

    const emptyDoneLane = screen.getByTestId('lane-empty-done')
    expect(emptyDoneLane).toHaveTextContent('Không có công việc nào trong cột này')
  })

  it('renders load more button on lanes that have next page', async () => {
    const user = userEvent.setup()
    const mockFetchNextPage = vi.fn()

    vi.mocked(useTaskBoardLane).mockImplementation((input: any) => {
      if (input.lane === 'todo') {
        return {
          data: {
            pages: [
              {
                lane: 'todo',
                items: mockTasksTodo,
                total: 40,
                hasMore: true,
                page: 1,
              },
            ],
          },
          isLoading: false,
          hasNextPage: true,
          fetchNextPage: mockFetchNextPage,
          isFetchingNextPage: false,
        } as any
      }
      return {
        data: { pages: [{ lane: input.lane, items: [], total: 0, hasMore: false, page: 1 }] },
        isLoading: false,
        hasNextPage: false,
      } as any
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

    const loadMoreBtn = screen.getByTestId('load-more-todo')
    expect(loadMoreBtn).toBeInTheDocument()
    expect(loadMoreBtn).toHaveTextContent('Tải thêm')

    await user.click(loadMoreBtn)
    expect(mockFetchNextPage).toHaveBeenCalledTimes(1)
  })

  it('renders mobile lane selector tabs and toggles visible lane', async () => {
    const user = userEvent.setup()

    render(
      <TaskBoard
        currentView="inbox"
        params={defaultParams}
        onSelectTask={vi.fn()}
        now={new Date()}
      />,
      { wrapper: createWrapper() }
    )

    const todoTab = screen.getByRole('tab', { name: 'Cần làm' })
    const inProgressTab = screen.getByRole('tab', { name: 'Đang làm' })
    const doneTab = screen.getByRole('tab', { name: 'Hoàn thành' })

    expect(todoTab).toHaveAttribute('aria-selected', 'true')
    expect(inProgressTab).toHaveAttribute('aria-selected', 'false')
    expect(doneTab).toHaveAttribute('aria-selected', 'false')

    // Initial state: todo lane is mobile-visible
    const todoLane = screen.getByTestId('task-board-lane-todo')
    const inProgressLane = screen.getByTestId('task-board-lane-in_progress')
    expect(todoLane).toHaveClass('mobile-visible')
    expect(inProgressLane).toHaveClass('mobile-hidden')

    // Switch to in_progress tab
    await user.click(inProgressTab)
    expect(inProgressTab).toHaveAttribute('aria-selected', 'true')
    expect(todoTab).toHaveAttribute('aria-selected', 'false')
    expect(inProgressLane).toHaveClass('mobile-visible')
    expect(todoLane).toHaveClass('mobile-hidden')
  })

  it('renders animated drop placeholder when dragging a task over a lane and removes on leave', () => {
    const { fireEvent } = require('@testing-library/react')

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

    // Initial state: no drop placeholder
    expect(screen.queryByTestId('task-drop-placeholder')).not.toBeInTheDocument()

    // Trigger dragOver
    fireEvent.dragOver(inProgressLane, {
      clientY: 100,
      dataTransfer: { dropEffect: 'none' },
    })

    // Placeholder must appear to indicate drop location
    expect(screen.getByTestId('task-drop-placeholder')).toBeInTheDocument()
    expect(screen.getByText('Thả công việc vào đây')).toBeInTheDocument()

    // Trigger dragLeave
    fireEvent.dragLeave(inProgressLane, {
      relatedTarget: document.body,
    })

    // Placeholder disappears
    expect(screen.queryByTestId('task-drop-placeholder')).not.toBeInTheDocument()
  })

  it('renders column options dropdown menu and can trigger quick add from menu', async () => {
    const user = userEvent.setup()

    render(
      <TaskBoard
        currentView="inbox"
        params={defaultParams}
        onSelectTask={vi.fn()}
        now={new Date()}
      />,
      { wrapper: createWrapper() }
    )

    const menuBtn = screen.getByTestId('lane-menu-btn-todo')
    expect(menuBtn).toBeInTheDocument()
    expect(screen.queryByTestId('lane-menu-dropdown-todo')).not.toBeInTheDocument()

    // Open dropdown
    await user.click(menuBtn)
    expect(screen.getByTestId('lane-menu-dropdown-todo')).toBeInTheDocument()
    expect(screen.getByText('Tùy chọn cột')).toBeInTheDocument()
    expect(screen.getByText('Làm mới danh sách')).toBeInTheDocument()

    // Click "Thêm công việc" from menu
    const addCardMenuItem = screen.getByTestId('lane-menu-add-card-todo')
    await user.click(addCardMenuItem)

    // Menu should close and quick add form should appear
    expect(screen.queryByTestId('lane-menu-dropdown-todo')).not.toBeInTheDocument()
    expect(screen.getByTestId('quick-add-form-todo')).toBeInTheDocument()
  })

  it('allows adding a card quickly at the bottom of the column', async () => {
    const user = userEvent.setup()

    render(
      <TaskBoard
        currentView="inbox"
        params={{ ...defaultParams, categoryId: 'cat-work' }}
        onSelectTask={vi.fn()}
        now={new Date()}
      />,
      { wrapper: createWrapper() }
    )

    // Trigger quick add from bottom button
    const quickAddTrigger = screen.getByTestId('quick-add-trigger-todo')
    expect(quickAddTrigger).toBeInTheDocument()
    await user.click(quickAddTrigger)

    // Quick add form should be displayed
    const textarea = screen.getByTestId('quick-add-input-todo')
    expect(textarea).toBeInTheDocument()

    // Submit button should be disabled when empty
    const submitBtn = screen.getByTestId('quick-add-submit-todo')
    expect(submitBtn).toBeDisabled()

    // Type task title
    await user.type(textarea, 'Tạo báo cáo tuần')
    expect(submitBtn).not.toBeDisabled()

    // Click submit
    await user.click(submitBtn)

    expect(mockCreateTaskMutateAsync).toHaveBeenCalledWith({
      title: 'Tạo báo cáo tuần',
      status: 'todo',
      categoryId: 'cat-work',
    })
  })

  it('allows cancelling quick add with Escape key or cancel button', async () => {
    const user = userEvent.setup()

    render(
      <TaskBoard
        currentView="inbox"
        params={defaultParams}
        onSelectTask={vi.fn()}
        now={new Date()}
      />,
      { wrapper: createWrapper() }
    )

    // Open quick add
    await user.click(screen.getByTestId('quick-add-trigger-todo'))
    expect(screen.getByTestId('quick-add-form-todo')).toBeInTheDocument()

    // Press Escape to cancel
    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('quick-add-form-todo')).not.toBeInTheDocument()
    expect(screen.getByTestId('quick-add-trigger-todo')).toBeInTheDocument()

    // Reopen and cancel via cancel button
    await user.click(screen.getByTestId('quick-add-trigger-todo'))
    await user.click(screen.getByTestId('quick-add-cancel-todo'))
    expect(screen.queryByTestId('quick-add-form-todo')).not.toBeInTheDocument()
  })

  it('handles same-lane drag and drop to reorder tasks with custom boardOrder', () => {
    const { fireEvent } = require('@testing-library/react')

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

    // Simulate drag over the lane to set drop index to 0
    fireEvent.dragOver(todoLane, {
      clientY: 50,
      dataTransfer: { dropEffect: 'move' },
    })

    // Simulate drop with task data
    fireEvent.drop(todoLane, {
      dataTransfer: {
        getData: (type: string) => {
          if (type === 'application/json') {
            return JSON.stringify({
              id: 'task-1',
              title: 'Design Kanban Board',
              status: 'todo',
              boardOrder: 100,
            })
          }
          if (type === 'text/plain') return 'task-1'
          return ''
        },
      },
    })

    // Dropping in same position (index 0 for the first item) is a no-op
    expect(mockChangeTaskStatusMutate).not.toHaveBeenCalled()
  })
})
