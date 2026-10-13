import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MonthlyReportPage } from '../MonthlyReportPage'
import * as monthlyTaskQueryModule from '../../features/summary/monthly-report/monthly-task-query'
import * as exportXlsxModule from '../../features/summary/monthly-report/export-xlsx'
import type { Task, Category } from '../../features/tasks/types'

vi.mock('../../features/auth/auth-provider', () => ({
  useAuth: () => ({
    profile: {
      id: 'u-1',
      displayName: 'Hoàng Mai',
      role: 'user',
      isActive: true,
      timezone: 'Asia/Ho_Chi_Minh',
      mustChangePassword: false,
      locale: 'vi',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  }),
}))

vi.mock('../../features/i18n/i18n-provider', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'common.retry': 'Thử lại',
        'monthlyReport.title': 'Xuất báo cáo công việc',
        'monthlyReport.subtitle': 'Điền dữ liệu công việc vào mẫu báo cáo Excel theo tháng hoặc khoảng thời gian tùy chọn.',
        'monthlyReport.periodMonthly': 'Theo tháng',
        'monthlyReport.periodCustom': 'Theo khoảng thời gian',
        'monthlyReport.month': 'Tháng',
        'monthlyReport.year': 'Năm',
        'monthlyReport.fromDate': 'Từ ngày',
        'monthlyReport.toDate': 'Đến ngày',
        'monthlyReport.selectTasksTitle': 'Chọn công việc đưa vào báo cáo',
        'monthlyReport.selectAll': 'Chọn tất cả',
        'monthlyReport.deselectAll': 'Bỏ chọn tất cả',
        'monthlyReport.noTasksFound': 'Không tìm thấy công việc nào phù hợp trong khoảng thời gian đã chọn.',
        'monthlyReport.notice': 'Lưu ý: Báo cáo phản ánh dữ liệu công việc hiện tại. Các cột Kết quả thực hiện, Vấn đề phát sinh, Hướng xử lý, Ghi chú và các phần Hỗ trợ / Kế hoạch tháng sau sẽ để trống để bạn nhập trực tiếp trong Excel.',
        'monthlyReport.exportBtn': 'Tải tệp Excel (.xlsx)',
        'monthlyReport.exporting': 'Đang tạo tệp...',
        'monthlyReport.loadError': 'Không thể tải danh sách công việc.',
        'monthlyReport.exportError': 'Đã có lỗi xảy ra khi tạo tệp báo cáo Excel.',
        'monthlyReport.back': 'Quay lại',
        'monthlyReport.filterHeadingTime': 'Khoảng thời gian',
        'monthlyReport.filterHeadingCriteria': 'Bộ lọc công việc',
        'monthlyReport.filterStatus': 'Trạng thái',
        'monthlyReport.filterCategory': 'Danh mục',
        'monthlyReport.allStatuses': 'Tất cả trạng thái',
        'monthlyReport.allCategories': 'Tất cả danh mục',
        'monthlyReport.statusDone': 'Hoàn thành',
        'monthlyReport.statusInProgress': 'Đang thực hiện',
        'monthlyReport.statusTodo': 'Chưa thực hiện',
        'monthlyReport.uncategorized': 'Không phân loại',
        'monthlyReport.periodType': 'Loại',
        'monthlyReport.typeMonth': 'Tháng',
        'monthlyReport.typeQuarter': 'Quý',
        'monthlyReport.typeCustom': 'Khoảng thời gian',
        'monthlyReport.quarter': 'Quý',
        'monthlyReport.searchPlaceholder': 'Tìm kiếm nhanh công việc...',
        'monthlyReport.noFilteredTasksFound': 'Không tìm thấy công việc nào phù hợp với bộ lọc hoặc tìm kiếm.',
      }
      return dict[key] || key
    },
  }),
}))

describe('MonthlyReportPage', () => {
  let queryClient: QueryClient

  const mockTask1: Task = {
    id: 't-1',
    userId: 'u-1',
    categoryId: 'c-1',
    parentId: null,
    title: 'Nhiệm vụ 1',
    description: null,
    status: 'done',
    priority: 'high',
    dueDateKind: 'date_only',
    startAt: null,
    dueAt: '2026-10-15T00:00:00Z',
    sourceUrl: null,
    completedAt: '2026-10-14T00:00:00Z',
    recurrenceRule: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-14T00:00:00Z',
  }

  const mockTask2: Task = {
    id: 't-2',
    userId: 'u-1',
    categoryId: 'c-2',
    parentId: null,
    title: 'Nhiệm vụ 2',
    description: null,
    status: 'in_progress',
    priority: 'medium',
    dueDateKind: 'date_only',
    startAt: null,
    dueAt: null,
    sourceUrl: null,
    completedAt: null,
    recurrenceRule: null,
    createdAt: '2026-10-02T00:00:00Z',
    updatedAt: '2026-10-02T00:00:00Z',
  }

  const mockCategories: Category[] = [
    {
      id: 'c-1',
      userId: 'u-1',
      name: 'Hành chính',
      icon: null,
      color: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'c-2',
      userId: 'u-1',
      name: 'Nhân sự',
      icon: null,
      color: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ]

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    vi.restoreAllMocks()

    // Default mock response
    vi.spyOn(monthlyTaskQueryModule, 'fetchMonthlyReportCandidateTasks').mockResolvedValue({
      candidates: [
        { task: mockTask1, categoryName: 'Hành chính' },
        { task: mockTask2, categoryName: 'Nhân sự' },
      ],
      categories: mockCategories,
    })
  })

  function renderPage() {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MonthlyReportPage />
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it('renders page header, period type dropdown, export button and notice banner', async () => {
    renderPage()

    expect(screen.getByText('Xuất báo cáo công việc')).toBeInTheDocument()
    expect(screen.getByTestId('monthly-report-period-type-trigger')).toBeInTheDocument()
    expect(screen.getByTestId('report-export-btn')).toBeInTheDocument()
    expect(screen.getByTestId('report-notice-banner')).toBeInTheDocument()
    expect(screen.getByTestId('monthly-report-back-btn')).toBeInTheDocument()

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByText('Nhiệm vụ 1')).toBeInTheDocument()
      expect(screen.getByText('Nhiệm vụ 2')).toBeInTheDocument()
    })

    // Check counter
    expect(screen.getByTestId('report-tasks-counter')).toHaveTextContent(
      'Đã chọn 2 / 2 công việc (2 nhóm)'
    )
  })

  it('allows switching between monthly, quarterly, and custom date range modes', async () => {
    renderPage()

    // Initially monthly mode
    expect(screen.getByTestId('monthly-report-month-select-trigger')).toBeInTheDocument()
    expect(screen.getByTestId('monthly-report-year-select-trigger')).toBeInTheDocument()

    // Switch to quarterly mode
    fireEvent.click(screen.getByTestId('monthly-report-period-type-trigger'))
    const quarterOpt = screen
      .getAllByRole('option', { name: 'Quý' })
      .find((el) => el.tagName === 'DIV')!
    fireEvent.click(quarterOpt)

    expect(screen.getByTestId('monthly-report-quarter-select-trigger')).toBeInTheDocument()
    expect(screen.getByTestId('monthly-report-year-select-trigger')).toBeInTheDocument()

    // Switch to custom range mode
    fireEvent.click(screen.getByTestId('monthly-report-period-type-trigger'))
    const customOpt = screen
      .getAllByRole('option', { name: 'Khoảng thời gian' })
      .find((el) => el.tagName === 'DIV')!
    fireEvent.click(customOpt)

    expect(screen.getByTestId('report-from-date-input')).toBeInTheDocument()
    expect(screen.getByTestId('report-to-date-input')).toBeInTheDocument()

    // Switch back to monthly
    fireEvent.click(screen.getByTestId('monthly-report-period-type-trigger'))
    const monthOpt = screen
      .getAllByRole('option', { name: 'Tháng' })
      .find((el) => el.tagName === 'DIV')!
    fireEvent.click(monthOpt)
    expect(screen.getByTestId('monthly-report-month-select-trigger')).toBeInTheDocument()
  })

  it('supports selecting and deselecting tasks', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Nhiệm vụ 1')).toBeInTheDocument()
    })

    // Both selected by default
    expect(screen.getByTestId('task-checkbox-t-1')).toBeChecked()
    expect(screen.getByTestId('task-checkbox-t-2')).toBeChecked()

    // Deselect all
    fireEvent.click(screen.getByTestId('deselect-all-btn'))
    expect(screen.getByTestId('task-checkbox-t-1')).not.toBeChecked()
    expect(screen.getByTestId('task-checkbox-t-2')).not.toBeChecked()
    expect(screen.getByTestId('report-tasks-counter')).toHaveTextContent(
      'Đã chọn 0 / 2 công việc (0 nhóm)'
    )

    // Toggle task 1 individually
    fireEvent.click(screen.getByTestId('task-checkbox-t-1'))
    expect(screen.getByTestId('task-checkbox-t-1')).toBeChecked()
    expect(screen.getByTestId('report-tasks-counter')).toHaveTextContent(
      'Đã chọn 1 / 2 công việc (1 nhóm)'
    )

    // Select all
    fireEvent.click(screen.getByTestId('select-all-btn'))
    expect(screen.getByTestId('task-checkbox-t-1')).toBeChecked()
    expect(screen.getByTestId('task-checkbox-t-2')).toBeChecked()
    expect(screen.getByTestId('report-tasks-counter')).toHaveTextContent(
      'Đã chọn 2 / 2 công việc (2 nhóm)'
    )
  })

  it('triggers export and handles template download', async () => {
    const mockArrayBuffer = new ArrayBuffer(8)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockArrayBuffer),
    } as any)

    const generateSpy = vi
      .spyOn(exportXlsxModule, 'generateReportXlsx')
      .mockReturnValue(new Uint8Array([1, 2, 3]))
    const downloadSpy = vi
      .spyOn(exportXlsxModule, 'downloadReportXlsx')
      .mockImplementation(() => {})

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Nhiệm vụ 1')).toBeInTheDocument()
    })

    const exportBtn = screen.getByTestId('report-export-btn')
    expect(exportBtn).not.toBeDisabled()

    fireEvent.click(exportBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/report-templates/monthly-work-report-v1.xlsx'
      )
      expect(generateSpy).toHaveBeenCalled()
      expect(downloadSpy).toHaveBeenCalled()
    })
  })

  it('filters candidate tasks by status and category', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Nhiệm vụ 1')).toBeInTheDocument()
      expect(screen.getByText('Nhiệm vụ 2')).toBeInTheDocument()
    })

    // 1. Filter by Status = done (Nhiệm vụ 1 is done, Nhiệm vụ 2 is in_progress)
    const statusTrigger = screen.getByTestId('monthly-report-status-filter-trigger')
    fireEvent.click(statusTrigger)
    const doneOption = screen
      .getAllByRole('option', { name: 'Hoàn thành' })
      .find((el) => el.tagName === 'DIV')!
    fireEvent.click(doneOption)

    // Only Nhiệm vụ 1 should be visible
    expect(screen.getByText('Nhiệm vụ 1')).toBeInTheDocument()
    expect(screen.queryByText('Nhiệm vụ 2')).not.toBeInTheDocument()
    expect(screen.getByTestId('report-tasks-counter')).toHaveTextContent(
      'Đã chọn 1 / 1 công việc hiển thị (1 nhóm) • Tổng trong kỳ: 2'
    )

    // 2. Filter by Category = Nhân sự (c-2)
    // First reset status to all
    fireEvent.click(screen.getByTestId('monthly-report-status-filter-trigger'))
    const allStatusOption = screen
      .getAllByRole('option', { name: 'Tất cả trạng thái' })
      .find((el) => el.tagName === 'DIV')!
    fireEvent.click(allStatusOption)

    // Now filter category
    const categoryTrigger = screen.getByTestId('monthly-report-category-filter-trigger')
    fireEvent.click(categoryTrigger)
    const hrCategoryOption = screen
      .getAllByRole('option', { name: 'Nhân sự' })
      .find((el) => el.tagName === 'DIV')!
    fireEvent.click(hrCategoryOption)

    // Only Nhiệm vụ 2 belongs to Nhân sự
    expect(screen.queryByText('Nhiệm vụ 1')).not.toBeInTheDocument()
    expect(screen.getByText('Nhiệm vụ 2')).toBeInTheDocument()
  })

  it('renders custom DatePicker triggers and popover in custom mode', async () => {
    renderPage()

    fireEvent.click(screen.getByTestId('monthly-report-period-type-trigger'))
    const customOpt = screen
      .getAllByRole('option', { name: 'Khoảng thời gian' })
      .find((el) => el.tagName === 'DIV')!
    fireEvent.click(customOpt)

    // Check custom DatePicker trigger buttons
    const fromTrigger = screen.getByTestId('report-from-date-input-trigger')
    const toTrigger = screen.getByTestId('report-to-date-input-trigger')
    expect(fromTrigger).toBeInTheDocument()
    expect(toTrigger).toBeInTheDocument()

    // Clicking trigger opens the custom calendar popover dialog
    fireEvent.click(fromTrigger)
    expect(screen.getByRole('dialog', { name: 'Bộ chọn ngày' })).toBeInTheDocument()
    expect(screen.getByText('CHỌN NHANH:')).toBeInTheDocument()
    expect(screen.getByText('LỊCH THÁNG:')).toBeInTheDocument()
  })

  it('displays error state when query fails', async () => {
    vi.spyOn(monthlyTaskQueryModule, 'fetchMonthlyReportCandidateTasks').mockRejectedValue(
      new Error('Lỗi kết nối cơ sở dữ liệu')
    )

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('report-load-error')).toBeInTheDocument()
      expect(screen.getByText('Lỗi kết nối cơ sở dữ liệu')).toBeInTheDocument()
    })
  })

  it('filters candidate tasks by quick search keyword and clears search', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Nhiệm vụ 1')).toBeInTheDocument()
      expect(screen.getByText('Nhiệm vụ 2')).toBeInTheDocument()
    })

    const searchInput = screen.getByTestId('report-tasks-search-input')
    expect(searchInput).toBeInTheDocument()

    // 1. Search for "Nhiệm vụ 1"
    fireEvent.change(searchInput, { target: { value: 'Nhiệm vụ 1' } })
    expect(screen.getByText('Nhiệm vụ 1')).toBeInTheDocument()
    expect(screen.queryByText('Nhiệm vụ 2')).not.toBeInTheDocument()
    expect(screen.getByTestId('report-tasks-counter')).toHaveTextContent(
      'Đã chọn 1 / 1 công việc hiển thị (1 nhóm) • Tổng trong kỳ: 2'
    )

    // Clear button should be visible
    const clearBtn = screen.getByTestId('report-tasks-search-clear')
    expect(clearBtn).toBeInTheDocument()

    // 2. Click clear button
    fireEvent.click(clearBtn)
    expect(searchInput).toHaveValue('')
    expect(screen.getByText('Nhiệm vụ 1')).toBeInTheDocument()
    expect(screen.getByText('Nhiệm vụ 2')).toBeInTheDocument()

    // 3. Search for category "Nhân sự"
    fireEvent.change(searchInput, { target: { value: 'nhân sự' } })
    expect(screen.queryByText('Nhiệm vụ 1')).not.toBeInTheDocument()
    expect(screen.getByText('Nhiệm vụ 2')).toBeInTheDocument()

    // 4. Search for non-existent keyword
    fireEvent.change(searchInput, { target: { value: 'Từ khóa không tồn tại xyz' } })
    expect(screen.queryByText('Nhiệm vụ 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Nhiệm vụ 2')).not.toBeInTheDocument()
    expect(screen.getByTestId('report-empty-filtered-tasks')).toBeInTheDocument()
  })

  it('renders dynamic year options based on current date and candidate tasks', async () => {
    renderPage()

    const yearTrigger = screen.getByTestId('monthly-report-year-select-trigger')
    expect(yearTrigger).toBeInTheDocument()
    fireEvent.click(yearTrigger)

    // Should include current year (2026), past years (e.g., 2021-2025), and future years (2027, 2028)
    expect(screen.getAllByRole('option', { name: 'Năm 2026' }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('option', { name: 'Năm 2025' }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('option', { name: 'Năm 2027' }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('option', { name: 'Năm 2028' }).length).toBeGreaterThanOrEqual(1)
  })
})
