import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from '../../../pages/DashboardPage'
import * as useDashboardModule from '../hooks/use-dashboard'

const mockedNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  }
})

vi.mock('../../i18n/i18n-provider', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'dashboard.title': 'Bảng điều khiển cá nhân',
        'dashboard.todayOverview': 'Tổng quan hôm nay',
        'dashboard.todayWorkload': 'Khối lượng hôm nay',
        'dashboard.completedToday': 'Đã hoàn thành',
        'dashboard.remaining': 'Còn lại',
        'dashboard.overdue': 'Quá hạn',
        'dashboard.inProgressTitle': 'Công việc đang làm',
        'dashboard.inProgressSubtitle': 'Các công việc bạn đang tích cực thực hiện',
        'dashboard.inProgressEmpty': 'Không có công việc nào đang thực hiện',
        'dashboard.viewAllInProgress': 'Xem tất cả',
        'dashboard.priorityTasks': 'Công việc ưu tiên',
        'dashboard.priorityTasksSubtitle': 'Các đầu việc quan trọng cần giải quyết trước',
        'dashboard.todaySchedule': 'Lịch làm việc hôm nay',
        'dashboard.todayScheduleSubtitle': 'Các khung giờ đã xếp lịch và phiên tập trung',
        'dashboard.upcomingDeadlines': 'Hạn chót sắp tới',
        'dashboard.upcomingDeadlinesSubtitle': 'Các công việc đến hạn trong 7 ngày tới',
        'dashboard.overdueAlertTitle': 'Công việc quá hạn cần xử lý',
        'dashboard.emptyTodayTasks': 'Hôm nay chưa có công việc.',
        'dashboard.emptyTodayTasksSub': 'Hãy thêm công việc mới hoặc lên lịch để bắt đầu ngày làm việc năng suất.',
        'dashboard.createTask': 'Tạo công việc',
        'dashboard.emptyTodaySchedule': 'Chưa có lịch làm việc hôm nay.',
        'dashboard.emptyTodayScheduleSub': 'Lên lịch công việc vào lịch biểu để quản lý thời gian tốt hơn.',
        'dashboard.goToCalendar': 'Mở lịch biểu',
        'dashboard.emptyUpcoming': 'Không có hạn chót nào trong 7 ngày tới.',
        'dashboard.viewAllTasks': 'Xem tất cả',
        'dashboard.viewSchedule': 'Xem lịch biểu',
        'common.retry': 'Thử lại',
      }
      return dict[key] || key
    },
    locale: 'vi',
  }),
}))

vi.mock('../../auth/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@tabdo.test' },
    profile: { id: 'user-1', role: 'user', timezone: 'Asia/Ho_Chi_Minh' },
  }),
  useOptionalAuth: () => ({
    user: { id: 'user-1', email: 'test@tabdo.test' },
    profile: { id: 'user-1', role: 'user', timezone: 'Asia/Ho_Chi_Minh' },
  }),
}))

vi.mock('../../../auth/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@tabdo.test' },
    profile: { id: 'user-1', role: 'user', timezone: 'Asia/Ho_Chi_Minh' },
  }),
  useOptionalAuth: () => ({
    user: { id: 'user-1', email: 'test@tabdo.test' },
    profile: { id: 'user-1', role: 'user', timezone: 'Asia/Ho_Chi_Minh' },
  }),
}))

vi.mock('../../tasks/components/task-drawer', () => ({
  TaskDrawer: ({ taskId, onClose }: any) => (
    <div data-testid="task-drawer" data-task-id={taskId}>
      <button onClick={() => onClose()}>Close</button>
    </div>
  ),
}))

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('DashboardPage — Layout & In Progress Widget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all 4 main sections in proper DOM order and with grid area classes', () => {
    vi.spyOn(useDashboardModule, 'useDashboard').mockReturnValue({
      snapshot: {
        metrics: {
          relevantCount: 0,
          completedCount: 0,
          remainingCount: 0,
          overdueCount: 0,
          completionPercentage: 0,
        },
        priorityTasks: [],
        overdueTasks: [],
        todaySchedule: [],
        upcomingTasks: [],
        inProgressTasks: [],
        inProgressTotal: 0,
      },
      metrics: {
        relevantCount: 0,
        completedCount: 0,
        remainingCount: 0,
        overdueCount: 0,
        completionPercentage: 0,
      },
      priorityTasks: [],
      overdueTasks: [],
      todaySchedule: [],
      upcomingTasks: [],
      inProgressTasks: [],
      inProgressTotal: 0,
      timeZone: 'Asia/Ho_Chi_Minh',
      dateStr: '2026-10-09',
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    renderDashboard()

    // 1. In Progress section exists with area class
    const inProgressSection = screen.getByRole('region', { name: 'Công việc đang làm' })
    expect(inProgressSection).toBeInTheDocument()
    expect(inProgressSection).toHaveClass('dashboard-area-in-progress')

    // 2. Priority section exists with area class
    const prioritySection = screen.getByRole('region', { name: 'Công việc ưu tiên' })
    expect(prioritySection).toBeInTheDocument()
    expect(prioritySection).toHaveClass('dashboard-area-priority')

    // 3. Today schedule section exists with area class
    const scheduleSection = screen.getByRole('region', { name: 'Lịch làm việc hôm nay' })
    expect(scheduleSection).toBeInTheDocument()
    expect(scheduleSection).toHaveClass('dashboard-area-schedule')

    // 4. Upcoming deadlines section exists with area class
    const upcomingSection = screen.getByRole('region', { name: 'Hạn chót sắp tới' })
    expect(upcomingSection).toBeInTheDocument()
    expect(upcomingSection).toHaveClass('dashboard-area-upcoming')

    // Verify DOM reading order: In Progress -> Priority -> Today Schedule -> Upcoming Deadlines
    const grid = document.querySelector('.dashboard-content-grid')
    expect(grid).not.toBeNull()
    const children = Array.from(grid!.children)
    expect(children[0]).toBe(inProgressSection)
    expect(children[1]).toBe(prioritySection)
    expect(children[2]).toBe(scheduleSection)
    expect(children[3]).toBe(upcomingSection)
  })

  it('renders In Progress tasks with count badge and navigates when card clicked', () => {
    const mockInProgressTask = {
      id: 'task-in-prog-1',
      userId: 'user-1',
      title: 'Review PR for Kanban board',
      status: 'in_progress',
      priority: 'high',
      dueDateKind: 'date_time',
      dueAt: '2026-10-09T11:00:00.000Z',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-09T08:00:00.000Z',
    }

    vi.spyOn(useDashboardModule, 'useDashboard').mockReturnValue({
      snapshot: {
        metrics: {
          relevantCount: 1,
          completedCount: 0,
          remainingCount: 1,
          overdueCount: 0,
          completionPercentage: 0,
        },
        priorityTasks: [],
        overdueTasks: [],
        todaySchedule: [],
        upcomingTasks: [],
        inProgressTasks: [mockInProgressTask],
        inProgressTotal: 3,
      },
      metrics: {
        relevantCount: 1,
        completedCount: 0,
        remainingCount: 1,
        overdueCount: 0,
        completionPercentage: 0,
      },
      priorityTasks: [],
      overdueTasks: [],
      todaySchedule: [],
      upcomingTasks: [],
      inProgressTasks: [mockInProgressTask],
      inProgressTotal: 3,
      timeZone: 'Asia/Ho_Chi_Minh',
      dateStr: '2026-10-09',
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    renderDashboard()

    // Title and total badge
    expect(screen.getByText('Công việc đang làm')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Review PR for Kanban board')).toBeInTheDocument()

    // Click task item opens modal in-place without navigating away
    const taskItem = screen.getByText('Review PR for Kanban board').closest('li')
    expect(taskItem).not.toBeNull()
    fireEvent.click(taskItem!)

    expect(mockedNavigate).not.toHaveBeenCalled()
    expect(screen.getByTestId('task-drawer')).toBeInTheDocument()
    expect(screen.getByTestId('task-drawer')).toHaveAttribute('data-task-id', 'task-in-prog-1')
  })

  it('renders empty state in In Progress section when total is 0', () => {
    vi.spyOn(useDashboardModule, 'useDashboard').mockReturnValue({
      snapshot: {
        metrics: {
          relevantCount: 0,
          completedCount: 0,
          remainingCount: 0,
          overdueCount: 0,
          completionPercentage: 0,
        },
        priorityTasks: [],
        overdueTasks: [],
        todaySchedule: [],
        upcomingTasks: [],
        inProgressTasks: [],
        inProgressTotal: 0,
      },
      metrics: {
        relevantCount: 0,
        completedCount: 0,
        remainingCount: 0,
        overdueCount: 0,
        completionPercentage: 0,
      },
      priorityTasks: [],
      overdueTasks: [],
      todaySchedule: [],
      upcomingTasks: [],
      inProgressTasks: [],
      inProgressTotal: 0,
      timeZone: 'Asia/Ho_Chi_Minh',
      dateStr: '2026-10-09',
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    renderDashboard()

    expect(screen.getByText('Không có công việc nào đang thực hiện')).toBeInTheDocument()
  })

  it('renders loading skeleton with grid-template-area skeleton cards', () => {
    vi.spyOn(useDashboardModule, 'useDashboard').mockReturnValue({
      snapshot: undefined,
      metrics: undefined,
      priorityTasks: [],
      overdueTasks: [],
      todaySchedule: [],
      upcomingTasks: [],
      inProgressTasks: [],
      inProgressTotal: 0,
      timeZone: 'Asia/Ho_Chi_Minh',
      dateStr: '2026-10-09',
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    renderDashboard()

    const loadingContainer = screen.getByRole('generic', { busy: true })
    expect(loadingContainer).toBeInTheDocument()
    expect(document.querySelector('.dashboard-area-in-progress.skeleton-card')).not.toBeNull()
    expect(document.querySelector('.dashboard-area-priority.skeleton-card')).not.toBeNull()
    expect(document.querySelector('.dashboard-area-schedule.skeleton-card')).not.toBeNull()
    expect(document.querySelector('.dashboard-area-upcoming.skeleton-card')).not.toBeNull()
  })

  it('collapses and expands TodayOverviewCard with localStorage persistence', () => {
    localStorage.clear()
    vi.spyOn(useDashboardModule, 'useDashboard').mockReturnValue({
      snapshot: {
        metrics: {
          relevantCount: 5,
          completedCount: 2,
          remainingCount: 3,
          overdueCount: 0,
          completionPercentage: 40,
        },
        priorityTasks: [],
        overdueTasks: [],
        todaySchedule: [],
        upcomingTasks: [],
        inProgressTasks: [],
        inProgressTotal: 0,
      },
      metrics: {
        relevantCount: 5,
        completedCount: 2,
        remainingCount: 3,
        overdueCount: 0,
        completionPercentage: 40,
      },
      priorityTasks: [],
      overdueTasks: [],
      todaySchedule: [],
      upcomingTasks: [],
      inProgressTasks: [],
      inProgressTotal: 0,
      timeZone: 'Asia/Ho_Chi_Minh',
      dateStr: '2026-10-09',
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    renderDashboard()

    const overviewCard = document.querySelector('.dashboard-overview-card')
    expect(overviewCard).not.toBeNull()
    expect(overviewCard).not.toHaveClass('is-collapsed')

    const toggleBtn = screen.getByTestId('collapse-overview-btn')
    expect(toggleBtn).toBeInTheDocument()

    // Collapse
    fireEvent.click(toggleBtn)
    expect(overviewCard).toHaveClass('is-collapsed')
    expect(localStorage.getItem('tabdo:dashboard:overview-collapsed')).toBe('true')
    expect(screen.getByText('40%')).toBeInTheDocument()

    // Expand
    fireEvent.click(toggleBtn)
    expect(overviewCard).not.toHaveClass('is-collapsed')
    expect(localStorage.getItem('tabdo:dashboard:overview-collapsed')).toBe('false')
  })

  it('collapses and expands OverdueTasks banner with localStorage persistence', () => {
    localStorage.clear()
    const mockOverdue = [
      {
        id: 'od-1',
        userId: 'u-1',
        title: 'Overdue task 1',
        status: 'todo',
        priority: 'high',
        dueDateKind: 'date_time',
        dueAt: '2026-10-01T00:00:00.000Z',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ]

    vi.spyOn(useDashboardModule, 'useDashboard').mockReturnValue({
      snapshot: {
        metrics: {
          relevantCount: 1,
          completedCount: 0,
          remainingCount: 1,
          overdueCount: 1,
          completionPercentage: 0,
        },
        priorityTasks: [],
        overdueTasks: mockOverdue,
        todaySchedule: [],
        upcomingTasks: [],
        inProgressTasks: [],
        inProgressTotal: 0,
      },
      metrics: {
        relevantCount: 1,
        completedCount: 0,
        remainingCount: 1,
        overdueCount: 1,
        completionPercentage: 0,
      },
      priorityTasks: [],
      overdueTasks: mockOverdue,
      todaySchedule: [],
      upcomingTasks: [],
      inProgressTasks: [],
      inProgressTotal: 0,
      timeZone: 'Asia/Ho_Chi_Minh',
      dateStr: '2026-10-09',
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    renderDashboard()

    const overdueAlert = document.querySelector('.dashboard-overdue-alert')
    expect(overdueAlert).not.toBeNull()
    expect(overdueAlert).not.toHaveClass('is-collapsed')
    expect(screen.getByText('Overdue task 1')).toBeInTheDocument()

    const toggleBtn = screen.getByTestId('collapse-overdue-btn')

    // Collapse
    fireEvent.click(toggleBtn)
    expect(overdueAlert).toHaveClass('is-collapsed')
    expect(localStorage.getItem('tabdo:dashboard:overdue-collapsed')).toBe('true')
    expect(screen.queryByText('Overdue task 1')).not.toBeInTheDocument()

    // Expand
    fireEvent.click(toggleBtn)
    expect(overdueAlert).not.toHaveClass('is-collapsed')
    expect(localStorage.getItem('tabdo:dashboard:overdue-collapsed')).toBe('false')
    expect(screen.getByText('Overdue task 1')).toBeInTheDocument()
  })

  it('renders scrollable containers inside active widgets', () => {
    vi.spyOn(useDashboardModule, 'useDashboard').mockReturnValue({
      snapshot: {
        metrics: {
          relevantCount: 0,
          completedCount: 0,
          remainingCount: 0,
          overdueCount: 0,
          completionPercentage: 0,
        },
        priorityTasks: [
          {
            id: 'p-1',
            userId: 'u-1',
            title: 'Priority 1',
            status: 'todo',
            priority: 'high',
            dueDateKind: 'date_time',
            createdAt: '2026-10-01T00:00:00.000Z',
            updatedAt: '2026-10-01T00:00:00.000Z',
          },
        ],
        overdueTasks: [],
        todaySchedule: [
          {
            id: 's-1',
            title: 'Schedule 1',
            startAt: '2026-10-09T08:00:00.000Z',
            endAt: '2026-10-09T09:00:00.000Z',
            taskId: null,
            taskTitle: null,
            taskStatus: null,
            taskPriority: null,
          },
        ],
        upcomingTasks: [
          {
            id: 'u-1',
            userId: 'u-1',
            title: 'Upcoming 1',
            status: 'todo',
            priority: 'medium',
            dueDateKind: 'date_time',
            createdAt: '2026-10-01T00:00:00.000Z',
            updatedAt: '2026-10-01T00:00:00.000Z',
          },
        ],
        inProgressTasks: [
          {
            id: 'ip-1',
            userId: 'u-1',
            title: 'In Progress 1',
            status: 'in_progress',
            priority: 'high',
            dueDateKind: 'date_time',
            createdAt: '2026-10-01T00:00:00.000Z',
            updatedAt: '2026-10-01T00:00:00.000Z',
          },
        ],
        inProgressTotal: 1,
      },
      metrics: {
        relevantCount: 0,
        completedCount: 0,
        remainingCount: 0,
        overdueCount: 0,
        completionPercentage: 0,
      },
      priorityTasks: [
        {
          id: 'p-1',
          userId: 'u-1',
          title: 'Priority 1',
          status: 'todo',
          priority: 'high',
          dueDateKind: 'date_time',
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
        },
      ],
      overdueTasks: [],
      todaySchedule: [
        {
          id: 's-1',
          title: 'Schedule 1',
          startAt: '2026-10-09T08:00:00.000Z',
          endAt: '2026-10-09T09:00:00.000Z',
          taskId: null,
          taskTitle: null,
          taskStatus: null,
          taskPriority: null,
        },
      ],
      upcomingTasks: [
        {
          id: 'u-1',
          userId: 'u-1',
          title: 'Upcoming 1',
          status: 'todo',
          priority: 'medium',
          dueDateKind: 'date_time',
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
        },
      ],
      inProgressTasks: [
        {
          id: 'ip-1',
          userId: 'u-1',
          title: 'In Progress 1',
          status: 'in_progress',
          priority: 'high',
          dueDateKind: 'date_time',
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
        },
      ],
      inProgressTotal: 1,
      timeZone: 'Asia/Ho_Chi_Minh',
      dateStr: '2026-10-09',
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    renderDashboard()

    const scrollContainers = document.querySelectorAll('.dashboard-scrollable-container')
    expect(scrollContainers.length).toBe(4)

    const scheduleScroll = document.querySelector('.dashboard-schedule-scroll')
    expect(scheduleScroll).not.toBeNull()
  })
})
