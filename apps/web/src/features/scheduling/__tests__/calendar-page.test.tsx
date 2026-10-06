import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarPage } from '../../../pages/CalendarPage'
import { useAuth } from '../../auth/auth-provider'
import { useScheduleBlockMutations } from '../hooks/use-schedule-block-mutations'
import { useScheduleBlocksInRange } from '../hooks/use-schedule-blocks'
import { useSchedulableTasks, useTaskList } from '../../tasks/hooks/use-tasks'

// Mock DayWeekCalendar to easily test interaction and revert without FullCalendar canvas
vi.mock('../components/day-week-calendar', () => ({
  DayWeekCalendar: ({
    events,
    onSelectSlot,
    onEventClick,
    onEventDrop,
    onEventResize,
  }: any) => (
    <div data-testid="mock-day-week-calendar">
      <div data-testid="calendar-event-count">{events.length}</div>
      <button
        data-testid="trigger-select-slot"
        onClick={() =>
          onSelectSlot?.({
            startAt: '2026-10-06T02:00:00.000Z',
            endAt: '2026-10-06T03:00:00.000Z',
          })
        }
      >
        Select Slot
      </button>
      {events.map((e: any) => (
        <div key={e.id} data-testid={`event-${e.id}`}>
          <span>{e.title}</span>
          <button data-testid={`click-event-${e.id}`} onClick={() => onEventClick?.(e)}>
            Edit
          </button>
          <button
            data-testid={`drop-event-${e.id}`}
            onClick={() =>
              onEventDrop?.({
                block: e,
                newStartAt: '2026-10-06T04:00:00.000Z',
                newEndAt: '2026-10-06T05:00:00.000Z',
                revert: vi.fn(),
              })
            }
          >
            Drop
          </button>
        </div>
      ))}
    </div>
  ),
}))

vi.mock('../../auth/auth-provider', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../hooks/use-schedule-blocks', () => ({
  useScheduleBlocksInRange: vi.fn(),
  useScheduleBlocksByTask: vi.fn(),
}))

vi.mock('../hooks/use-schedule-block-mutations', () => ({
  useScheduleBlockMutations: vi.fn(),
}))

vi.mock('../../tasks/hooks/use-tasks', () => ({
  useTaskList: vi.fn(),
  useTaskDetail: vi.fn(),
  useSubtasks: vi.fn(),
  useSchedulableTasks: vi.fn(),
}))

describe('CalendarPage', () => {
  const mockMutateUpdate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useAuth).mockReturnValue({
      profile: { timezone: 'Asia/Ho_Chi_Minh' } as any,
      user: { id: 'test-user' } as any,
    } as any)

    vi.mocked(useScheduleBlocksInRange).mockReturnValue({
      data: [
        {
          id: 'b-1',
          userId: 'test-user',
          title: 'Planning Session',
          startAt: '2026-10-06T02:00:00.000Z',
          endAt: '2026-10-06T03:00:00.000Z',
          createdAt: '2026-10-06T01:00:00.000Z',
          updatedAt: '2026-10-06T01:00:00.000Z',
        },
      ] as any,
      isLoading: false,
    } as any)

    vi.mocked(useScheduleBlockMutations).mockReturnValue({
      createMutation: { mutateAsync: vi.fn(), isPending: false } as any,
      updateMutation: { mutateAsync: mockMutateUpdate, isPending: false } as any,
      deleteMutation: { mutateAsync: vi.fn(), isPending: false } as any,
    })

    vi.mocked(useTaskList).mockReturnValue({
      data: [{ id: 't-1', title: 'Task to Schedule', status: 'todo' }] as any,
      isLoading: false,
    } as any)

    vi.mocked(useSchedulableTasks).mockReturnValue({
      data: [{ id: 't-1', title: 'Task to Schedule', status: 'todo' }] as any,
      isLoading: false,
    } as any)
  })

  it('normalizes URL query parameters to canonical view and date when missing', async () => {
    render(
      <MemoryRouter initialEntries={['/calendar']}>
        <Routes>
          <Route path="/calendar" element={<CalendarPage />} />
        </Routes>
      </MemoryRouter>
    )

    // Range derivation query called
    expect(useScheduleBlocksInRange).toHaveBeenCalledWith(
      expect.objectContaining({
        startAt: expect.any(String),
        endAt: expect.any(String),
      })
    )
    expect(screen.getByTestId('calendar-page')).toBeInTheDocument()
    expect(screen.getByTestId('mock-day-week-calendar')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-event-count')).toHaveTextContent('1')
  })

  it('opens schedule editor modal when slot is selected or add schedule clicked', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/calendar?view=week&date=2026-10-06']}>
        <Routes>
          <Route path="/calendar" element={<CalendarPage />} />
        </Routes>
      </MemoryRouter>
    )

    await user.click(screen.getByTestId('trigger-select-slot'))
    expect(screen.getByTestId('schedule-editor-modal')).toBeInTheDocument()
    expect(screen.getByText('Lên lịch làm việc')).toBeInTheDocument()
  })

  it('opens schedule editor in edit mode when event is clicked', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/calendar?view=week&date=2026-10-06']}>
        <Routes>
          <Route path="/calendar" element={<CalendarPage />} />
        </Routes>
      </MemoryRouter>
    )

    await user.click(screen.getByTestId('click-event-b-1'))
    expect(screen.getByTestId('schedule-editor-modal')).toBeInTheDocument()
    expect(screen.getByText('Chỉnh sửa lịch trình')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Planning Session')).toBeInTheDocument()
  })

  it('reverts event drop and displays error banner when update mutation fails', async () => {
    const user = userEvent.setup()
    mockMutateUpdate.mockRejectedValueOnce(
      new Error('Schedule block was updated or deleted by another session. Please refresh.')
    )

    render(
      <MemoryRouter initialEntries={['/calendar?view=week&date=2026-10-06']}>
        <Routes>
          <Route path="/calendar" element={<CalendarPage />} />
        </Routes>
      </MemoryRouter>
    )

    await user.click(screen.getByTestId('drop-event-b-1'))

    await waitFor(() => {
      expect(screen.getByTestId('calendar-mutation-error')).toBeInTheDocument()
      expect(screen.getByTestId('calendar-mutation-error')).toHaveTextContent(
        'Schedule block was updated or deleted by another session'
      )
    })
  })

  it('toggles unscheduled tasks sidebar when toggle button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/calendar?view=week&date=2026-10-06']}>
        <Routes>
          <Route path="/calendar" element={<CalendarPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByTestId('unscheduled-tasks-sidebar')).toBeInTheDocument()
    await user.click(screen.getByTestId('toggle-unscheduled-sidebar-btn'))
    expect(screen.queryByTestId('unscheduled-tasks-sidebar')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('toggle-unscheduled-sidebar-btn'))
    expect(screen.getByTestId('unscheduled-tasks-sidebar')).toBeInTheDocument()
  })
})
