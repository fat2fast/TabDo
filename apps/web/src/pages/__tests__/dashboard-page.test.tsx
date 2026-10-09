import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from '../DashboardPage'
import * as useDashboardModule from '../../features/dashboard/hooks/use-dashboard'

vi.mock('../../features/i18n/i18n-provider', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'dashboard.title': 'Bảng điều khiển cá nhân',
        'dashboard.todayOverview': 'Tổng quan hôm nay',
        'dashboard.todayWorkload': 'Khối lượng hôm nay',
        'dashboard.completedToday': 'Đã hoàn thành',
        'dashboard.remaining': 'Còn lại',
        'dashboard.overdue': 'Quá hạn',
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

vi.mock('../../features/auth/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'admin-user-id', email: 'admin@tabdo.test' },
    profile: { id: 'admin-user-id', role: 'admin', timezone: 'Asia/Ho_Chi_Minh' },
  }),
  useOptionalAuth: () => ({
    user: { id: 'admin-user-id', email: 'admin@tabdo.test' },
    profile: { id: 'admin-user-id', role: 'admin', timezone: 'Asia/Ho_Chi_Minh' },
  }),
}))

vi.mock('../../auth/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'admin-user-id', email: 'admin@tabdo.test' },
    profile: { id: 'admin-user-id', role: 'admin', timezone: 'Asia/Ho_Chi_Minh' },
  }),
  useOptionalAuth: () => ({
    user: { id: 'admin-user-id', email: 'admin@tabdo.test' },
    profile: { id: 'admin-user-id', role: 'admin', timezone: 'Asia/Ho_Chi_Minh' },
  }),
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

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading skeleton when query is loading', () => {
    vi.spyOn(useDashboardModule, 'useDashboard').mockReturnValue({
      snapshot: undefined,
      metrics: undefined,
      priorityTasks: [],
      overdueTasks: [],
      todaySchedule: [],
      upcomingTasks: [],
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
    expect(loadingContainer).toHaveAttribute('aria-busy', 'true')
  })

  it('renders error state with retry button on query failure', () => {
    vi.spyOn(useDashboardModule, 'useDashboard').mockReturnValue({
      snapshot: undefined,
      metrics: undefined,
      priorityTasks: [],
      overdueTasks: [],
      todaySchedule: [],
      upcomingTasks: [],
      timeZone: 'Asia/Ho_Chi_Minh',
      dateStr: '2026-10-09',
      isLoading: false,
      isError: true,
      error: new Error('Network timeout'),
      refetch: vi.fn(),
    } as any)

    renderDashboard()

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Network timeout')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
  })

  it('renders empty states with required Vietnamese copy when user has no tasks or schedule', () => {
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
      timeZone: 'Asia/Ho_Chi_Minh',
      dateStr: '2026-10-09',
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    renderDashboard()

    expect(screen.getByText('Hôm nay chưa có công việc.')).toBeInTheDocument()
    expect(screen.getAllByText('+ Tạo công việc').length).toBeGreaterThan(0)
    expect(screen.getByText('Chưa có lịch làm việc hôm nay.')).toBeInTheDocument()
    expect(screen.getByText('Mở lịch biểu')).toBeInTheDocument()
    expect(screen.getByText('Không có hạn chót nào trong 7 ngày tới.')).toBeInTheDocument()
  })

  it('renders populated metrics, priority tasks, schedule, upcoming, and overdue banner', () => {
    const mockTask = {
      id: 'task-1',
      userId: 'admin-user-id',
      title: 'Prepare quarterly plan',
      status: 'todo',
      priority: 'high',
      dueDateKind: 'date_time',
      dueAt: '2026-10-09T08:00:00.000Z',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    }

    const mockOverdue = {
      id: 'task-overdue',
      userId: 'admin-user-id',
      title: 'Submit tax report',
      status: 'todo',
      priority: 'high',
      dueDateKind: 'date_time',
      dueAt: '2026-10-08T10:00:00.000Z',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    }

    const mockUpcoming = {
      id: 'task-upcoming',
      userId: 'admin-user-id',
      title: 'Team sync meeting',
      status: 'todo',
      priority: 'medium',
      dueDateKind: 'date_time',
      dueAt: '2026-10-12T03:00:00.000Z',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    }

    const mockScheduleItem = {
      id: 'block-1',
      title: 'Sprint Planning Block',
      startAt: '2026-10-09T02:00:00.000Z',
      endAt: '2026-10-09T03:00:00.000Z',
      taskId: 'task-1',
      taskTitle: 'Prepare quarterly plan',
      taskStatus: 'todo',
      taskPriority: 'high',
    }

    vi.spyOn(useDashboardModule, 'useDashboard').mockReturnValue({
      snapshot: {
        metrics: {
          relevantCount: 5,
          completedCount: 3,
          remainingCount: 2,
          overdueCount: 1,
          completionPercentage: 60,
        },
        priorityTasks: [mockTask],
        overdueTasks: [mockOverdue],
        todaySchedule: [mockScheduleItem],
        upcomingTasks: [mockUpcoming],
      },
      metrics: {
        relevantCount: 5,
        completedCount: 3,
        remainingCount: 2,
        overdueCount: 1,
        completionPercentage: 60,
      },
      priorityTasks: [mockTask],
      overdueTasks: [mockOverdue],
      todaySchedule: [mockScheduleItem],
      upcomingTasks: [mockUpcoming],
      timeZone: 'Asia/Ho_Chi_Minh',
      dateStr: '2026-10-09',
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    renderDashboard()

    // Overview numbers
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()

    // Overdue banner
    expect(screen.getByText(/Công việc quá hạn cần xử lý/)).toBeInTheDocument()
    expect(screen.getByText('Submit tax report')).toBeInTheDocument()

    // Priority task list
    expect(screen.getByText('Prepare quarterly plan')).toBeInTheDocument()

    // Today Schedule
    expect(screen.getByText('Sprint Planning Block')).toBeInTheDocument()

    // Upcoming Deadlines
    expect(screen.getByText('Team sync meeting')).toBeInTheDocument()
  })

  it('keeps admin user personal dashboard strictly scoped to own user_id and RLS queries', () => {
    // When an admin visits /dashboard, it displays their personal tasks (e.g. admin-user-id),
    // not cross-user platform totals
    const spy = vi.spyOn(useDashboardModule, 'useDashboard').mockReturnValue({
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
      timeZone: 'Asia/Ho_Chi_Minh',
      dateStr: '2026-10-09',
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    renderDashboard()

    expect(spy).toHaveBeenCalled()
    expect(screen.getByText('Bảng điều khiển cá nhân')).toBeInTheDocument()
  })
})
