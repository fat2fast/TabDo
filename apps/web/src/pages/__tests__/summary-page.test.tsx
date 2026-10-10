import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SummaryPage } from '../SummaryPage'
import * as useSummaryModule from '../../features/summary/hooks/use-summary'
import type { DailySummary, WeeklySummary } from '../../features/summary/types'

vi.mock('../../features/i18n/i18n-provider', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'summary.title': 'Tổng kết tiến độ',
        'summary.dailyTab': 'Theo ngày',
        'summary.weeklyTab': 'Theo tuần',
        'summary.previousDay': 'Ngày trước',
        'summary.nextDay': 'Ngày sau',
        'summary.previousWeek': 'Tuần trước',
        'summary.nextWeek': 'Tuần sau',
        'summary.todayButton': 'Hôm nay',
        'summary.selectDate': 'Chọn ngày...',
        'summary.plannedCount': 'Theo kế hoạch',
        'summary.completedCount': 'Đã hoàn thành',
        'summary.completionRate': 'Tỷ lệ hoàn thành',
        'summary.carryOverCount': 'Chuyển tiếp',
        'summary.overdueCount': 'Quá hạn',
        'summary.completedPlannedCount': 'hoàn thành theo kế hoạch',
        'summary.noPlannedTasks': 'Không có kế hoạch',
        'summary.completedSection': 'Công việc đã hoàn thành',
        'summary.completedEmpty': 'Chưa hoàn thành công việc nào trong khoảng thời gian này.',
        'summary.carryOverSection': 'Công việc chuyển tiếp (chưa xong)',
        'summary.carryOverEmpty': 'Không có công việc chuyển tiếp nào.',
        'summary.overdueSection': 'Công việc quá hạn',
        'summary.overdueEmpty': 'Không có công việc nào bị quá hạn.',
        'summary.weeklyOverviewTitle': 'Tổng quan tuần',
        'summary.mostProductiveDay': 'Ngày năng suất nhất',
        'summary.noProductiveDay': 'Chưa có dữ liệu',
        'summary.sevenDayChartTitle': 'Tiến độ hoàn thành 7 ngày',
        'summary.categoryBreakdownTitle': 'Phân loại công việc',
        'summary.categoryEmpty': 'Chưa có danh mục nào được hoàn thành.',
        'summary.previousWeekComparisonTitle': 'So sánh với tuần trước',
        'summary.previousWeekRateDiff': 'điểm phần trăm',
        'summary.previousWeekCountDiff': 'công việc',
        'summary.noPreviousData': 'Không có dữ liệu tuần trước để so sánh',
        'summary.dayMon': 'Thứ 2',
        'summary.dayTue': 'Thứ 3',
        'summary.dayWed': 'Thứ 4',
        'summary.dayThu': 'Thứ 5',
        'summary.dayFri': 'Thứ 6',
        'summary.daySat': 'Thứ 7',
        'summary.daySun': 'Chủ nhật',
        'summary.approximationNotice': 'Lưu ý: Dữ liệu tổng kết quá khứ dựa trên trạng thái công việc và nhật ký hiện có, mang tính chất ước lượng tương đối.',
        'summary.loading': 'Đang tải tổng kết...',
        'summary.errorTitle': 'Không thể tải tổng kết',
        'summary.retry': 'Thử lại',
        'categories.uncategorized': 'Không phân loại',
      }
      return dict[key] || key
    },
    locale: 'vi',
  }),
}))

vi.mock('../../features/auth/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'user@tabdo.test' },
    profile: { id: 'test-user-id', role: 'user', timezone: 'Asia/Ho_Chi_Minh' },
  }),
}))

vi.mock('../../features/tasks/components/task-drawer', () => ({
  TaskDrawer: ({ taskId, onClose }: any) =>
    taskId ? (
      <div data-testid="task-drawer" data-task-id={taskId}>
        <button onClick={onClose}>Đóng</button>
      </div>
    ) : null,
}))

describe('SummaryPage', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    vi.clearAllMocks()
  })

  const renderWithRouter = (initialRoute = '/summary') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route path="/summary" element={<SummaryPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it('renders loading state when query is loading', () => {
    vi.spyOn(useSummaryModule, 'useSummary').mockReturnValue({
      summary: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
      timeZone: 'Asia/Ho_Chi_Minh',
    } as any)

    renderWithRouter()
    expect(screen.getByTestId('summary-loading')).toBeInTheDocument()
  })

  it('renders error state and handles retry click', () => {
    const mockRefetch = vi.fn()
    vi.spyOn(useSummaryModule, 'useSummary').mockReturnValue({
      summary: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network error occurred'),
      refetch: mockRefetch,
      timeZone: 'Asia/Ho_Chi_Minh',
    } as any)

    renderWithRouter()
    expect(screen.getByTestId('summary-error-card')).toBeInTheDocument()
    expect(screen.getByText('Network error occurred')).toBeInTheDocument()

    const retryBtn = screen.getByTestId('summary-retry-btn')
    fireEvent.click(retryBtn)
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('renders daily summary view with metrics and task lists', () => {
    const mockDaily: DailySummary = {
      period: 'daily',
      dateStr: '2026-10-10',
      startAt: '2026-10-09T17:00:00.000Z',
      endAt: '2026-10-10T17:00:00.000Z',
      isCurrentPeriod: true,
      cutoffAt: '2026-10-10T05:00:00.000Z',
      plannedCount: 5,
      completedCount: 3,
      completedPlannedCount: 3,
      completionRate: 0.6,
      carryOverCount: 2,
      overdueCount: 1,
      completedTasks: [
        {
          id: 't-comp-1',
          userId: 'test-user-id',
          title: 'Finished Task 1',
          status: 'done',
          priority: 'high',
          dueDateKind: 'date_time',
          completedAt: '2026-10-10T03:00:00.000Z',
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-10T03:00:00.000Z',
        },
      ],
      carryOverTasks: [
        {
          id: 't-carry-1',
          userId: 'test-user-id',
          title: 'Incomplete Planned Task',
          status: 'todo',
          priority: 'medium',
          dueDateKind: 'date_time',
          dueAt: '2026-10-10T08:00:00.000Z',
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
        },
      ],
      overdueTasks: [
        {
          id: 't-overdue-1',
          userId: 'test-user-id',
          title: 'Overdue Task Item',
          status: 'todo',
          priority: 'high',
          dueDateKind: 'date_time',
          dueAt: '2026-10-10T01:00:00.000Z',
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
        },
      ],
    }

    vi.spyOn(useSummaryModule, 'useSummary').mockReturnValue({
      summary: mockDaily,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      timeZone: 'Asia/Ho_Chi_Minh',
    } as any)

    renderWithRouter('/summary?period=daily&date=2026-10-10')

    // Expect approximation banner
    expect(screen.getByTestId('summary-notice-banner')).toBeInTheDocument()

    // Expect completion metric numbers
    expect(screen.getByTestId('metric-planned-count')).toHaveTextContent('5')
    expect(screen.getByTestId('metric-completed-count')).toHaveTextContent('3')
    expect(screen.getByTestId('metric-carryover-count')).toHaveTextContent('2')
    expect(screen.getByTestId('metric-overdue-count')).toHaveTextContent('1')

    // Expect task items
    expect(screen.getByText('Finished Task 1')).toBeInTheDocument()
    expect(screen.getByText('Incomplete Planned Task')).toBeInTheDocument()
    expect(screen.getByText('Overdue Task Item')).toBeInTheDocument()
  })

  it('renders weekly summary view with 7-day chart, peak day, and category breakdown', () => {
    const mockWeekly: WeeklySummary = {
      period: 'weekly',
      dateStr: '2026-10-10',
      weekStartStr: '2026-10-05',
      weekEndStr: '2026-10-11',
      startAt: '2026-10-04T17:00:00.000Z',
      endAt: '2026-10-11T17:00:00.000Z',
      isCurrentPeriod: true,
      cutoffAt: '2026-10-10T05:00:00.000Z',
      plannedCount: 10,
      completedCount: 8,
      completedPlannedCount: 8,
      completionRate: 0.8,
      carryOverCount: 2,
      overdueCount: 0,
      mostProductiveDay: {
        dateStr: '2026-10-05',
        dayOfWeek: 1,
        dayLabelKey: 'summary.dayMon',
        count: 4,
      },
      dailyBreakdown: [
        { dateStr: '2026-10-05', dayOfWeek: 1, dayLabelKey: 'summary.dayMon', count: 4 },
        { dateStr: '2026-10-06', dayOfWeek: 2, dayLabelKey: 'summary.dayTue', count: 1 },
        { dateStr: '2026-10-07', dayOfWeek: 3, dayLabelKey: 'summary.dayWed', count: 2 },
        { dateStr: '2026-10-08', dayOfWeek: 4, dayLabelKey: 'summary.dayThu', count: 1 },
        { dateStr: '2026-10-09', dayOfWeek: 5, dayLabelKey: 'summary.dayFri', count: 0 },
        { dateStr: '2026-10-10', dayOfWeek: 6, dayLabelKey: 'summary.daySat', count: 0 },
        { dateStr: '2026-10-11', dayOfWeek: 7, dayLabelKey: 'summary.daySun', count: 0 },
      ],
      categoryBreakdown: [
        {
          categoryId: 'cat-1',
          name: 'Công việc',
          color: '#3b82f6',
          count: 5,
          isUncategorized: false,
        },
        {
          categoryId: null,
          name: 'Uncategorized',
          color: null,
          count: 3,
          isUncategorized: true,
        },
      ],
      comparisonVsPreviousWeek: {
        previousCompletedCount: 6,
        diffCompletedCount: 2,
        previousRate: 0.7,
        rateDiffPercentagePoints: 10,
      },
      completedTasks: [],
      carryOverTasks: [],
      overdueTasks: [],
    }

    vi.spyOn(useSummaryModule, 'useSummary').mockReturnValue({
      summary: mockWeekly,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      timeZone: 'Asia/Ho_Chi_Minh',
    } as any)

    renderWithRouter('/summary?period=weekly&date=2026-10-10')

    expect(screen.getByTestId('weekly-summary-view')).toBeInTheDocument()
    expect(screen.getByTestId('summary-weekly-chart')).toBeInTheDocument()
    expect(screen.getByTestId('summary-peak-day')).toHaveTextContent('Thứ 2')

    // Comparison card
    expect(screen.getByTestId('summary-comparison-card')).toBeInTheDocument()
    expect(screen.getByText('+2 công việc')).toBeInTheDocument()
    expect(screen.getByText('+10 điểm phần trăm')).toBeInTheDocument()

    // Category breakdown
    expect(screen.getByTestId('category-item-cat-1')).toHaveTextContent('Công việc')
    expect(screen.getByTestId('category-item-uncategorized')).toHaveTextContent('Không phân loại')
  })

  it('safely defaults invalid period query param to daily', () => {
    const useSummarySpy = vi.spyOn(useSummaryModule, 'useSummary').mockReturnValue({
      summary: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
      timeZone: 'Asia/Ho_Chi_Minh',
    } as any)

    renderWithRouter('/summary?period=invalid_period_value')

    expect(useSummarySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        period: 'daily',
      })
    )
  })

  it('accepts direct navigation to /summary, /summary?period=daily, and /summary?period=weekly', () => {
    const useSummarySpy = vi.spyOn(useSummaryModule, 'useSummary').mockReturnValue({
      summary: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
      timeZone: 'Asia/Ho_Chi_Minh',
    } as any)

    // Direct /summary
    const { unmount } = renderWithRouter('/summary')
    expect(useSummarySpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ period: 'daily' })
    )
    unmount()

    // /summary?period=daily
    const { unmount: unmountDaily } = renderWithRouter('/summary?period=daily&date=2026-10-15')
    expect(useSummarySpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ period: 'daily', selectedDateStr: '2026-10-15' })
    )
    unmountDaily()

    // /summary?period=weekly
    renderWithRouter('/summary?period=weekly&date=2026-10-15')
    expect(useSummarySpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ period: 'weekly', selectedDateStr: '2026-10-15' })
    )
  })

  it('opens task drawer modal when a summary task item is clicked', () => {
    const mockDaily: DailySummary = {
      period: 'daily',
      dateStr: '2026-10-10',
      startAt: '2026-10-09T17:00:00.000Z',
      endAt: '2026-10-10T17:00:00.000Z',
      isCurrentPeriod: true,
      cutoffAt: '2026-10-10T12:00:00.000Z',
      plannedCount: 1,
      completedCount: 1,
      completedPlannedCount: 1,
      completionRate: 1,
      carryOverCount: 0,
      overdueCount: 0,
      completedTasks: [
        {
          id: 'task-modal-target-1',
          userId: 'test-user-id',
          title: 'Clickable Summary Task',
          status: 'done',
          priority: 'medium',
          dueDateKind: 'date_time',
          dueAt: null,
          completedAt: '2026-10-10T03:00:00.000Z',
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-10T03:00:00.000Z',
        },
      ],
      carryOverTasks: [],
      overdueTasks: [],
    }

    vi.spyOn(useSummaryModule, 'useSummary').mockReturnValue({
      summary: mockDaily,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      timeZone: 'Asia/Ho_Chi_Minh',
    } as any)

    renderWithRouter('/summary')

    expect(screen.queryByTestId('task-drawer')).not.toBeInTheDocument()

    // Click on the task item
    fireEvent.click(screen.getByText('Clickable Summary Task'))

    expect(screen.getByTestId('task-drawer')).toBeInTheDocument()
    expect(screen.getByTestId('task-drawer')).toHaveAttribute('data-task-id', 'task-modal-target-1')
  })
})
