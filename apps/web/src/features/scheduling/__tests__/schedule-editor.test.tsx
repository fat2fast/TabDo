import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ScheduleEditor } from '../components/schedule-editor'
import { useScheduleBlockMutations } from '../hooks/use-schedule-block-mutations'
import { useSchedulableTasks, useTaskDetail } from '../../tasks/hooks/use-tasks'
import { useAuth } from '../../auth/auth-provider'

vi.mock('../../auth/auth-provider', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../../tasks/hooks/use-tasks', () => ({
  useSchedulableTasks: vi.fn(),
  useTaskDetail: vi.fn(),
}))

vi.mock('../hooks/use-schedule-block-mutations', () => ({
  useScheduleBlockMutations: vi.fn(),
}))

describe('ScheduleEditor', () => {
  const mockMutateCreate = vi.fn()
  const mockMutateUpdate = vi.fn()
  const mockMutateDelete = vi.fn()
  const mockOnClose = vi.fn()
  const mockOnSuccess = vi.fn()
  const mockOnDeleted = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({
      profile: { timezone: 'Asia/Ho_Chi_Minh' } as any,
      user: { id: 'test-user' } as any,
    } as any)

    vi.mocked(useSchedulableTasks).mockReturnValue({
      data: [{ id: 'task-1', title: 'Task 1', status: 'todo' }] as any,
      isLoading: false,
    } as any)

    vi.mocked(useTaskDetail).mockReturnValue({
      data: null,
      isLoading: false,
    } as any)

    vi.mocked(useScheduleBlockMutations).mockReturnValue({
      createMutation: { mutateAsync: mockMutateCreate, isPending: false } as any,
      updateMutation: { mutateAsync: mockMutateUpdate, isPending: false } as any,
      deleteMutation: { mutateAsync: mockMutateDelete, isPending: false } as any,
    })
  })

  it('validates non-blank title and prevents submission with error message', async () => {
    const user = userEvent.setup()
    render(
      <ScheduleEditor
        isOpen={true}
        onClose={mockOnClose}
        initialStartAt="2026-10-06T02:00:00.000Z"
        initialEndAt="2026-10-06T04:00:00.000Z"
      />
    )

    const titleInput = screen.getByTestId('schedule-title-input')
    await user.clear(titleInput)
    await user.click(screen.getByTestId('schedule-save-btn'))

    expect(screen.getByTestId('schedule-editor-error')).toHaveTextContent(
      'Vui lòng nhập tiêu đề cho lịch trình.'
    )
    expect(mockMutateCreate).not.toHaveBeenCalled()
  })

  it('validates end time must be after start time', async () => {
    const user = userEvent.setup()
    render(
      <ScheduleEditor
        isOpen={true}
        onClose={mockOnClose}
        initialStartAt="2026-10-06T02:00:00.000Z"
        initialEndAt="2026-10-06T04:00:00.000Z"
      />
    )

    await user.type(screen.getByTestId('schedule-title-input'), 'Valid Title')
    // Set start 10:00, end 09:00
    fireEvent.change(screen.getByTestId('schedule-start-time'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByTestId('schedule-end-time'), { target: { value: '09:00' } })

    await user.click(screen.getByTestId('schedule-save-btn'))

    expect(screen.getByTestId('schedule-editor-error')).toHaveTextContent(
      'Thời gian kết thúc phải diễn ra sau thời gian bắt đầu.'
    )
    expect(mockMutateCreate).not.toHaveBeenCalled()
  })

  it('submits create mutation with local times converted to UTC instants', async () => {
    const user = userEvent.setup()
    mockMutateCreate.mockResolvedValueOnce({ id: 'block-new', title: 'New Event' })

    render(
      <ScheduleEditor
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        initialStartAt="2026-10-06T02:00:00.000Z"
        initialEndAt="2026-10-06T04:00:00.000Z"
      />
    )

    await user.type(screen.getByTestId('schedule-title-input'), 'Coding session')
    await user.click(screen.getByTestId('schedule-save-btn'))

    await waitFor(() => {
      expect(mockMutateCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Coding session',
          startAt: '2026-10-06T02:00:00.000Z',
          endAt: '2026-10-06T04:00:00.000Z',
        })
      )
      expect(mockOnSuccess).toHaveBeenCalled()
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  it('supports delete with confirmation in edit mode', async () => {
    const user = userEvent.setup()
    mockMutateDelete.mockResolvedValueOnce({})

    const existingBlock = {
      id: 'block-1',
      userId: 'test-user',
      title: 'Existing Block',
      startAt: '2026-10-06T02:00:00.000Z',
      endAt: '2026-10-06T04:00:00.000Z',
      createdAt: '2026-10-06T01:00:00.000Z',
      updatedAt: '2026-10-06T01:00:00.000Z',
    }

    render(
      <ScheduleEditor
        isOpen={true}
        onClose={mockOnClose}
        onDeleted={mockOnDeleted}
        initialBlock={existingBlock}
      />
    )

    // Click delete -> shows confirmation
    await user.click(screen.getByTestId('schedule-delete-btn'))
    expect(screen.getByTestId('schedule-delete-confirm-btn')).toBeInTheDocument()

    // Confirm delete
    await user.click(screen.getByTestId('schedule-delete-confirm-btn'))

    await waitFor(() => {
      expect(mockMutateDelete).toHaveBeenCalledWith({
        id: 'block-1',
        previousUpdatedAt: '2026-10-06T01:00:00.000Z',
      })
      expect(mockOnDeleted).toHaveBeenCalledWith('block-1')
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  it('displays linked task with completion label and status pill when task is done', async () => {
    const completedTask = {
      id: 'task-completed-123',
      title: 'ssssssss',
      status: 'done',
      priority: 'medium',
    }

    vi.mocked(useTaskDetail).mockReturnValue({
      data: completedTask as any,
      isLoading: false,
    } as any)

    const blockWithCompletedTask = {
      id: 'block-2',
      userId: 'test-user',
      title: 'ssssssss',
      taskId: 'task-completed-123',
      startAt: '2026-10-06T06:43:00.000Z',
      endAt: '2026-10-06T08:43:00.000Z',
      createdAt: '2026-10-06T01:00:00.000Z',
      updatedAt: '2026-10-06T01:00:00.000Z',
    }

    render(
      <ScheduleEditor
        isOpen={true}
        onClose={mockOnClose}
        initialBlock={blockWithCompletedTask}
      />
    )

    // The dropdown button should display the linked task with completion indicator
    expect(screen.getByTestId('schedule-task-select')).toHaveTextContent('ssssssss (✓ Đã hoàn thành)')

    // The linked task status badge should also be displayed
    const pill = screen.getByTestId('linked-task-status-pill')
    expect(pill).toBeInTheDocument()
    expect(pill).toHaveTextContent('ssssssss')
    expect(pill).toHaveTextContent('✓ Đã hoàn thành')
  })

  it('closes the editor when Escape key is pressed', async () => {
    render(
      <ScheduleEditor
        isOpen={true}
        onClose={mockOnClose}
        initialStartAt="2026-10-06T02:00:00.000Z"
        initialEndAt="2026-10-06T04:00:00.000Z"
      />
    )

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })
})
