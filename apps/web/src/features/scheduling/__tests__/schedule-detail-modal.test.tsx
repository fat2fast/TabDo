import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ScheduleDetailModal } from '../components/schedule-detail-modal'
import { useAuth } from '../../auth/auth-provider'
import { useTaskDetail } from '../../tasks/hooks/use-tasks'
import { useTaskMutations } from '../../tasks/hooks/use-task-mutations'
import { useScheduleBlockMutations } from '../hooks/use-schedule-block-mutations'
import { useConfirm } from '../../../components/ui/confirm-dialog'

vi.mock('../../auth/auth-provider', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../../tasks/hooks/use-tasks', () => ({
  useTaskDetail: vi.fn(),
}))

vi.mock('../../tasks/hooks/use-task-mutations', () => ({
  useTaskMutations: vi.fn(),
}))

vi.mock('../hooks/use-schedule-block-mutations', () => ({
  useScheduleBlockMutations: vi.fn(),
}))

vi.mock('../../../components/ui/confirm-dialog', () => ({
  useConfirm: vi.fn(),
}))

describe('ScheduleDetailModal', () => {
  const mockBlock = {
    id: 'block-1',
    userId: 'user-1',
    taskId: 'task-1',
    title: 'Code Review Meeting',
    startAt: '2026-10-14T02:00:00.000Z',
    endAt: '2026-10-14T03:00:00.000Z',
    createdAt: '2026-10-13T00:00:00.000Z',
    updatedAt: '2026-10-13T00:00:00.000Z',
  }

  const mockAllDayBlock = {
    id: 'block-2',
    userId: 'user-1',
    taskId: null,
    title: 'All Day Workshop',
    startAt: '2026-10-13T17:00:00.000Z', // 00:00 ICT Oct 14
    endAt: '2026-10-14T16:59:00.000Z',   // 23:59 ICT Oct 14
    createdAt: '2026-10-13T00:00:00.000Z',
    updatedAt: '2026-10-13T00:00:00.000Z',
  }

  const mockDeleteMutate = vi.fn()
  const mockCompleteTaskMutate = vi.fn()
  const mockConfirm = vi.fn()
  const mockOnClose = vi.fn()
  const mockOnEdit = vi.fn()
  const mockOnDeleted = vi.fn()
  const mockOnOpenTaskDetail = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useAuth).mockReturnValue({
      profile: { timezone: 'Asia/Ho_Chi_Minh' } as any,
    } as any)

    vi.mocked(useConfirm).mockReturnValue(mockConfirm)

    vi.mocked(useScheduleBlockMutations).mockReturnValue({
      deleteMutation: { mutateAsync: mockDeleteMutate, isPending: false } as any,
    } as any)

    vi.mocked(useTaskMutations).mockReturnValue({
      completeTaskMutation: { mutateAsync: mockCompleteTaskMutate, isPending: false } as any,
    } as any)

    vi.mocked(useTaskDetail).mockReturnValue({
      data: {
        id: 'task-1',
        title: 'Triển khai tính năng Kanban',
        status: 'in_progress',
        priority: 'high',
      } as any,
      isLoading: false,
    } as any)
  })

  it('renders schedule title, time, and linked task details', () => {
    render(
      <ScheduleDetailModal
        isOpen={true}
        block={mockBlock}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDeleted={mockOnDeleted}
        onOpenTaskDetail={mockOnOpenTaskDetail}
      />
    )

    expect(screen.getByTestId('schedule-detail-modal')).toBeInTheDocument()
    expect(screen.getByText('Code Review Meeting')).toBeInTheDocument()
    expect(screen.getByText('Triển khai tính năng Kanban')).toBeInTheDocument()
    expect(screen.getByText('Đang làm')).toBeInTheDocument()
    expect(screen.getByText('Cao')).toBeInTheDocument()
    expect(screen.getByText('Đánh dấu hoàn thành')).toBeInTheDocument()
  })

  it('renders all-day badge when block is an all-day event', () => {
    vi.mocked(useTaskDetail).mockReturnValue({ data: null, isLoading: false } as any)

    render(
      <ScheduleDetailModal
        isOpen={true}
        block={mockAllDayBlock}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDeleted={mockOnDeleted}
      />
    )

    expect(screen.getByText('All Day Workshop')).toBeInTheDocument()
    expect(screen.getAllByText('Cả ngày').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Lịch độc lập (Không liên kết công việc)')).toBeInTheDocument()
  })

  it('calls onEdit when edit icon is clicked', async () => {
    const user = userEvent.setup()

    render(
      <ScheduleDetailModal
        isOpen={true}
        block={mockBlock}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
      />
    )

    await user.click(screen.getByTestId('schedule-detail-edit-btn'))
    expect(mockOnEdit).toHaveBeenCalledWith(mockBlock)
  })

  it('calls onOpenTaskDetail when linked task title is clicked', async () => {
    const user = userEvent.setup()

    render(
      <ScheduleDetailModal
        isOpen={true}
        block={mockBlock}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onOpenTaskDetail={mockOnOpenTaskDetail}
      />
    )

    await user.click(screen.getByTestId('schedule-detail-open-task-btn'))
    expect(mockOnOpenTaskDetail).toHaveBeenCalledWith('task-1')
  })

  it('completes task when Mark completed button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <ScheduleDetailModal
        isOpen={true}
        block={mockBlock}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
      />
    )

    await user.click(screen.getByTestId('schedule-detail-mark-complete-btn'))
    expect(mockCompleteTaskMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-1' })
    )
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('confirms and deletes schedule block when trash icon is clicked', async () => {
    const user = userEvent.setup()
    mockConfirm.mockResolvedValueOnce(true)

    render(
      <ScheduleDetailModal
        isOpen={true}
        block={mockBlock}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDeleted={mockOnDeleted}
      />
    )

    await user.click(screen.getByTestId('schedule-detail-delete-btn'))
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'danger' })
    )
    expect(mockDeleteMutate).toHaveBeenCalledWith({
      id: 'block-1',
      previousUpdatedAt: mockBlock.updatedAt,
    })
    expect(mockOnDeleted).toHaveBeenCalledWith('block-1')
    expect(mockOnClose).toHaveBeenCalled()
  })
})
