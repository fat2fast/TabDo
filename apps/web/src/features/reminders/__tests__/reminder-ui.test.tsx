import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReminderList } from '../components/reminder-list'
import { ReminderEditor } from '../components/reminder-editor'
import { useAuth } from '../../auth/auth-provider'
import { useReminderMutations } from '../hooks/use-reminder-mutations'
import { useRemindersByTask } from '../hooks/use-reminders'
import type { Task } from '../../tasks/types'

vi.mock('../../auth/auth-provider', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../hooks/use-reminders', () => ({
  useRemindersByTask: vi.fn(),
  useUpcomingReminders: vi.fn(),
}))

vi.mock('../hooks/use-reminder-mutations', () => ({
  useReminderMutations: vi.fn(),
}))

describe('Reminder UI components', () => {
  const mockCreate = vi.fn()
  const mockUpdate = vi.fn()
  const mockSnooze = vi.fn()
  const mockDismiss = vi.fn()
  const mockDelete = vi.fn()

  const timedTask: Task = {
    id: 'task-1',
    userId: 'user-1',
    title: 'Timed Task',
    status: 'todo',
    priority: 'high',
    dueDateKind: 'date_time',
    dueAt: '2026-10-06T15:00:00.000Z',
    createdAt: '2026-10-06T08:00:00.000Z',
    updatedAt: '2026-10-06T08:00:00.000Z',
  }

  const dateOnlyTask: Task = {
    id: 'task-2',
    userId: 'user-1',
    title: 'Date Only Task',
    status: 'todo',
    priority: 'medium',
    dueDateKind: 'date_only',
    dueAt: '2026-10-06T17:00:00.000Z',
    createdAt: '2026-10-06T08:00:00.000Z',
    updatedAt: '2026-10-06T08:00:00.000Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useAuth).mockReturnValue({
      profile: { timezone: 'Asia/Ho_Chi_Minh' } as any,
      user: { id: 'user-1' } as any,
    } as any)

    vi.mocked(useReminderMutations).mockReturnValue({
      createMutation: { mutateAsync: mockCreate, isPending: false } as any,
      updateMutation: { mutateAsync: mockUpdate, isPending: false } as any,
      snoozeMutation: { mutateAsync: mockSnooze, isPending: false } as any,
      dismissMutation: { mutateAsync: mockDismiss, isPending: false } as any,
      deleteMutation: { mutateAsync: mockDelete, isPending: false } as any,
    })
  })

  it('disables relative presets and shows hint when task has no timed due date', () => {
    vi.mocked(useRemindersByTask).mockReturnValue({
      data: [],
      isLoading: false,
    } as any)

    render(<ReminderList task={dateOnlyTask} />)

    expect(screen.getByTestId('relative-disabled-hint')).toBeInTheDocument()
    const presetBtn = screen.getByTestId('preset-btn-15')
    expect(presetBtn).toBeDisabled()

    // Custom button remains enabled
    expect(screen.getByTestId('custom-reminder-btn')).not.toBeDisabled()
  })

  it('allows selecting relative preset for timed task and triggers createMutation', async () => {
    const user = userEvent.setup()
    vi.mocked(useRemindersByTask).mockReturnValue({
      data: [],
      isLoading: false,
    } as any)

    render(<ReminderList task={timedTask} />)

    const preset15 = screen.getByTestId('preset-btn-15')
    expect(preset15).not.toBeDisabled()

    await user.click(preset15)

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-1',
          reminderKind: 'relative_due',
          offsetMinutes: 15,
        })
      )
    })
  })

  it('supports creating custom absolute reminder without a due date', async () => {
    const user = userEvent.setup()
    const mockOnClose = vi.fn()

    const taskWithoutDue: Task = {
      ...dateOnlyTask,
      dueAt: null,
    }

    render(
      <ReminderEditor
        isOpen={true}
        onClose={mockOnClose}
        task={taskWithoutDue}
      />
    )

    // Relative radio should be disabled
    expect(screen.getByTestId('kind-relative-radio')).toBeDisabled()
    expect(screen.getByTestId('kind-absolute-radio')).toBeChecked()

    fireEvent.change(screen.getByTestId('reminder-date-input'), {
      target: { value: '2026-10-10' },
    })
    fireEvent.change(screen.getByTestId('reminder-time-input'), {
      target: { value: '14:30' },
    })

    await user.click(screen.getByTestId('reminder-save-btn'))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-2',
          reminderKind: 'absolute',
          remindAt: expect.any(String),
        })
      )
    })
  })

  it('renders existing reminders with snooze, dismiss, edit, and delete controls', async () => {
    const user = userEvent.setup()
    const existingReminder = {
      id: 'rem-active',
      userId: 'user-1',
      taskId: 'task-1',
      remindAt: '2026-10-06T14:45:00.000Z',
      status: 'pending' as const,
      snoozedUntil: null,
      reminderKind: 'relative_due' as const,
      offsetMinutes: 15,
      effectiveAt: '2026-10-06T14:45:00.000Z',
      createdAt: '2026-10-06T08:00:00.000Z',
      updatedAt: '2026-10-06T08:00:00.000Z',
    }

    vi.mocked(useRemindersByTask).mockReturnValue({
      data: [existingReminder],
      isLoading: false,
    } as any)

    render(<ReminderList task={timedTask} />)

    expect(screen.getByTestId('reminder-item-rem-active')).toBeInTheDocument()

    // Test snooze action
    await user.click(screen.getByTestId('snooze-15-rem-active'))
    expect(mockSnooze).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'rem-active',
        previousUpdatedAt: '2026-10-06T08:00:00.000Z',
      })
    )

    // Test dismiss action
    await user.click(screen.getByTestId('dismiss-rem-active'))
    expect(mockDismiss).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'rem-active',
        previousUpdatedAt: '2026-10-06T08:00:00.000Z',
      })
    )

    // Test delete action
    await user.click(screen.getByTestId('delete-reminder-rem-active'))
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'rem-active',
        taskId: 'task-1',
        previousUpdatedAt: '2026-10-06T08:00:00.000Z',
      })
    )
  })
})
