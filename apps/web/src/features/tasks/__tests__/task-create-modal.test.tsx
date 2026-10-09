import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskCreateModal } from '../components/task-create-modal'
import { TaskForm } from '../components/task-form'
import { TaskRow } from '../components/task-row'
import type { Task } from '../types'
import * as tasksApi from '../api/tasks'

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

vi.mock('../../auth/auth-provider', () => {
  const mockAuth = {
    profile: {
      id: 'u-1',
      timezone: 'Asia/Ho_Chi_Minh',
      role: 'user',
      displayName: 'Test User',
    },
    session: {
      user: { id: 'u-1', email: 'test@tabdo.local' },
    },
  }
  return {
    useAuth: () => mockAuth,
    useOptionalAuth: () => mockAuth,
  }
})

vi.mock('../hooks/use-categories', () => ({
  useCategories: () => ({
    data: [
      { id: 'cat-1', name: 'Công việc', color: '#0284c7' },
      { id: 'cat-2', name: 'Cá nhân', color: '#16a34a' },
    ],
  }),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('TaskCreateModal & Completed Task Locking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('TaskCreateModal', () => {
    it('does not render when isOpen is false', () => {
      render(
        <TaskCreateModal isOpen={false} onClose={vi.fn()} />,
        { wrapper: createWrapper() }
      )
      expect(screen.queryByTestId('task-create-modal')).not.toBeInTheDocument()
    })

    it('renders with initial title and creates a task with detailed attributes', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      const onTaskCreated = vi.fn()

      const createdMock: Task = {
        id: 'new-task-1',
        userId: 'u-1',
        title: 'Báo cáo doanh thu tháng',
        description: 'Phân tích chi tiết theo quý',
        status: 'todo',
        priority: 'high',
        categoryId: 'cat-1',
        dueDateKind: 'date_time',
        dueAt: '2026-10-15T10:00:00.000Z',
        createdAt: '2026-10-09T00:00:00Z',
        updatedAt: '2026-10-09T00:00:00Z',
      }

      vi.spyOn(tasksApi, 'createTask').mockResolvedValue(createdMock)

      render(
        <TaskCreateModal
          isOpen={true}
          onClose={onClose}
          initialTitle="Báo cáo doanh thu"
          defaultCategoryId="cat-1"
          onTaskCreated={onTaskCreated}
        />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByTestId('task-create-modal')).toBeInTheDocument()
      const titleInput = screen.getByLabelText(/Tiêu đề \*/i)
      expect(titleInput).toHaveValue('Báo cáo doanh thu')

      // Type updated title
      await user.type(titleInput, ' tháng')

      // Submit the form
      const submitBtn = screen.getByRole('button', { name: /\+ Tạo công việc/i })
      await user.click(submitBtn)

      await waitFor(() => {
        expect(tasksApi.createTask).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Báo cáo doanh thu tháng',
            categoryId: 'cat-1',
            status: 'todo',
          })
        )
        expect(onTaskCreated).toHaveBeenCalledWith(createdMock)
        expect(onClose).toHaveBeenCalled()
      })
    })
  })

  describe('TaskForm Completed Locking', () => {
    const completedTask: Task = {
      id: 'task-done-1',
      userId: 'u-1',
      title: 'Đã hoàn thành dự án',
      description: 'Ghi chú tổng kết',
      status: 'done',
      priority: 'high',
      dueDateKind: 'date_time',
      dueAt: '2026-10-08T09:00:00Z',
      completedAt: '2026-10-08T15:30:00Z',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-08T15:30:00Z',
    }

    it('locks inputs, displays completed banner and read-only badge when task is done', () => {
      render(
        <TaskForm task={completedTask} onCancel={vi.fn()} />,
        { wrapper: createWrapper() }
      )

      // Banner is rendered
      expect(screen.getByTestId('task-completed-locked-banner')).toBeInTheDocument()
      expect(screen.getByText('Công việc đã hoàn thành')).toBeInTheDocument()
      expect(screen.getByText(/Hoàn thành lúc: 08\/10\/2026 22:30/i)).toBeInTheDocument()

      // Inputs are disabled
      const titleInput = screen.getByLabelText(/Tiêu đề \*/i)
      expect(titleInput).toBeDisabled()

      // Save button is replaced by read-only badge
      expect(screen.queryByRole('button', { name: /Lưu thay đổi/i })).not.toBeInTheDocument()
      expect(screen.getByText(/Đã hoàn thành \(Chỉ xem\)/i)).toBeInTheDocument()

      // Reopen button is available
      expect(screen.getByRole('button', { name: /↺ Mở lại công việc/i })).toBeInTheDocument()
    })
  })

  describe('TaskRow Completed Timestamp Chip', () => {
    it('displays completion chip with formatted timestamp when task is done', () => {
      const completedTask: Task = {
        id: 'row-done-1',
        userId: 'u-1',
        title: 'Thiết kế biểu đồ',
        status: 'done',
        priority: 'medium',
        dueDateKind: 'date_time',
        dueAt: '2026-10-08T09:00:00Z',
        completedAt: '2026-10-08T10:15:00Z',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-08T10:15:00Z',
      }

      render(
        <TaskRow task={completedTask} onSelect={vi.fn()} />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByText(/Hoàn thành 08\/10\/2026 17:15/i)).toBeInTheDocument()
    })
  })

  describe('TaskCreateModal Utility Tabs', () => {
    it('renders all 6 utility tabs and allows tab navigation', async () => {
      const user = userEvent.setup()

      render(
        <TaskCreateModal isOpen={true} onClose={vi.fn()} />,
        { wrapper: createWrapper() }
      )

      // Verify all 6 tab buttons exist
      expect(screen.getByRole('tab', { name: /Checklist/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Lịch làm việc/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Lời nhắc/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Việc con/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Đính kèm/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Liên kết/i })).toBeInTheDocument()

      // Switch to "Việc con" tab
      await user.click(screen.getByRole('tab', { name: /Việc con/i }))
      expect(screen.getByText(/Danh sách việc con dự kiến/i)).toBeInTheDocument()

      // Add a draft subtask
      const subtaskInput = screen.getByPlaceholderText(/Nhập tiêu đề việc con/i)
      await user.type(subtaskInput, 'Việc con thử nghiệm')
      await user.click(screen.getByRole('button', { name: /\+ Thêm việc con/i }))
      expect(screen.getByText('Việc con thử nghiệm')).toBeInTheDocument()

      // Switch to "Lịch làm việc" tab
      await user.click(screen.getByRole('tab', { name: /Lịch làm việc/i }))
      expect(screen.getByText(/Lên lịch làm việc cho công việc này trên Calendar/i)).toBeInTheDocument()

      // Switch to "Lời nhắc" tab
      await user.click(screen.getByRole('tab', { name: /Lời nhắc/i }))
      expect(screen.getByText(/Tạo lời nhắc cho công việc này/i)).toBeInTheDocument()
    })
  })

  describe('TaskDrawer and TaskDetailView (Info List View Mode)', () => {
    const sampleTask: Task = {
      id: 'task-view-1',
      userId: 'u-1',
      title: 'Xây dựng trang Dashboard',
      description: 'Mô tả chi tiết bằng markdown **in đậm**',
      status: 'in_progress',
      priority: 'high',
      categoryId: 'cat-1',
      dueDateKind: 'date_time',
      dueAt: '2026-10-15T10:00:00.000Z',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-02T00:00:00Z',
    }

    it('renders TaskDetailView in Info List format by default, not edit inputs', async () => {
      const user = userEvent.setup()
      vi.spyOn(tasksApi, 'getTaskById').mockResolvedValue(sampleTask)

      const { TaskDrawer } = await import('../components/task-drawer')

      render(
        <TaskDrawer taskId="task-view-1" onClose={vi.fn()} />,
        { wrapper: createWrapper() }
      )

      // Wait for task to load
      expect(await screen.findByTestId('task-detail-view')).toBeInTheDocument()

      // Verify title is rendered as heading, not an editable input field
      const heading = screen.getByTestId('detail-view-title')
      expect(heading).toHaveTextContent('Xây dựng trang Dashboard')
      expect(screen.queryByPlaceholderText(/Nhập tiêu đề công việc\.\.\./i)).not.toBeInTheDocument()

      // Verify Info List property cards
      expect(screen.getByTestId('detail-info-card-properties')).toBeInTheDocument()
      expect(screen.getByTestId('detail-info-card-timeline')).toBeInTheDocument()
      expect(screen.getByText('Thuộc tính công việc')).toBeInTheDocument()
      expect(screen.getByText('Thời gian & Lập lịch')).toBeInTheDocument()

      // Verify Edit button is present and switches to TaskForm
      const editBtn = screen.getByTestId('detail-edit-btn')
      expect(editBtn).toBeInTheDocument()

      await user.click(editBtn)

      // Form input should now appear in Edit Mode
      expect(await screen.findByTestId('task-form')).toBeInTheDocument()
      expect(screen.getByLabelText(/Tiêu đề \*/i)).toHaveValue('Xây dựng trang Dashboard')
    })
  })
})
