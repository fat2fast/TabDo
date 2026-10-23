import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarPage } from '../../../pages/CalendarPage'
import { useAuth } from '../../auth/auth-provider'
import { useScheduleBlockMutations } from '../hooks/use-schedule-block-mutations'
import { useScheduleBlocksInRange } from '../hooks/use-schedule-blocks'
import {
  useSchedulableTasks,
  useSubtasks,
  useTaskDetail,
  useTaskList,
} from '../../tasks/hooks/use-tasks'

// Mock DayWeekCalendar to easily test interaction and revert without FullCalendar canvas
vi.mock('../components/day-week-calendar', () => ({
  DayWeekCalendar: ({
    events,
    onSelectSlot,
    onEventClick,
    onEventDrop,
    _onEventResize,
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

vi.mock('../../tasks/hooks/use-task-mutations', () => ({
  useTaskMutations: () => ({
    completeTaskMutation: { mutateAsync: vi.fn(), isPending: false },
  }),
}))

let latestCalendarLoc: any = null
function CalendarLocationObserver() {
  const loc = useLocation()
  latestCalendarLoc = loc
  return null
}

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

    vi.mocked(useTaskDetail).mockReturnValue({
      data: null,
      isLoading: false,
    } as any)

    vi.mocked(useSubtasks).mockReturnValue({
      data: [],
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

  it('opens schedule detail modal when event is clicked, and can transition to edit modal', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/calendar?view=week&date=2026-10-06']}>
        <Routes>
          <Route path="/calendar" element={<CalendarPage />} />
        </Routes>
      </MemoryRouter>
    )

    // Click event in calendar -> opens ScheduleDetailModal
    await user.click(screen.getByTestId('click-event-b-1'))
    const detailModal = screen.getByTestId('schedule-detail-modal')
    expect(detailModal).toBeInTheDocument()
    expect(within(detailModal).getByText('Planning Session')).toBeInTheDocument()

    // Click edit button in detail modal -> opens ScheduleEditor
    await user.click(screen.getByTestId('schedule-detail-edit-btn'))
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
  it('renders agenda presentation when display=agenda is set in search params', async () => {
    render(
      <MemoryRouter initialEntries={['/calendar?view=week&date=2026-10-06&display=agenda']}>
        <Routes>
          <Route path="/calendar" element={<CalendarPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByTestId('mobile-agenda')).toBeInTheDocument()
    expect(screen.queryByTestId('mock-day-week-calendar')).not.toBeInTheDocument()
    expect(screen.getByText('Planning Session')).toBeInTheDocument()
  })

  it('renders grid presentation when display=grid is set in search params', async () => {
    render(
      <MemoryRouter initialEntries={['/calendar?view=week&date=2026-10-06&display=grid']}>
        <Routes>
          <Route path="/calendar" element={<CalendarPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByTestId('mock-day-week-calendar')).toBeInTheDocument()
    expect(screen.queryByTestId('mobile-agenda')).not.toBeInTheDocument()
  })

  it('toggles display between grid and agenda and preserves unknown query parameters', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/calendar?view=week&date=2026-10-06&customParam=preserved123&display=grid']}>
        <CalendarLocationObserver />
        <Routes>
          <Route path="/calendar" element={<CalendarPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByTestId('mock-day-week-calendar')).toBeInTheDocument()

    // Click Agenda toggle button
    const agendaBtn = screen.getByTestId('display-agenda-btn')
    await user.click(agendaBtn)

    expect(await screen.findByTestId('mobile-agenda')).toBeInTheDocument()
    expect(screen.queryByTestId('mock-day-week-calendar')).not.toBeInTheDocument()

    const params = new URLSearchParams(latestCalendarLoc.search)
    expect(params.get('customParam')).toBe('preserved123')
    expect(params.get('display')).toBe('agenda')
    expect(params.get('view')).toBe('week')
    expect(params.get('date')).toBe('2026-10-06')
  })

  it('manages responsive sidebar lifecycle: no unintended modal on mobile resize, scroll lock cleanup on desktop resize', async () => {
    const user = userEvent.setup()

    // Setup controllable matchMedia mock
    let currentMatches = false
    const listeners = new Set<(e: MediaQueryListEvent) => void>()
    const mockMql = {
      get matches() {
        return currentMatches
      },
      media: '(max-width: 768px)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
        if (event === 'change') listeners.add(handler)
      }),
      removeEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
        if (event === 'change') listeners.delete(handler)
      }),
      dispatchEvent: vi.fn(),
    }

    const originalMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation(() => mockMql)
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })

    const { unmount } = render(
      <MemoryRouter initialEntries={['/calendar?view=week&date=2026-10-06']}>
        <Routes>
          <Route path="/calendar" element={<CalendarPage />} />
        </Routes>
      </MemoryRouter>
    )

    // 1. Initial desktop view: desktop sidebar visible, mobile overlay NOT present
    expect(screen.getByTestId('calendar-desktop-sidebar')).toBeInTheDocument()
    expect(screen.queryByTestId('unscheduled-mobile-overlay')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')

    // 2. Toggle sidebar on desktop: collapses and expands
    const toggleBtn = screen.getByTestId('toggle-unscheduled-sidebar-btn')
    await user.click(toggleBtn)
    expect(screen.queryByTestId('calendar-desktop-sidebar')).not.toBeInTheDocument()
    expect(screen.queryByTestId('unscheduled-mobile-overlay')).not.toBeInTheDocument()

    await user.click(toggleBtn)
    expect(screen.getByTestId('calendar-desktop-sidebar')).toBeInTheDocument()

    // 3. Resize Desktop -> Mobile: update matchMedia and trigger listener
    act(() => {
      currentMatches = true
      window.innerWidth = 390
      listeners.forEach((fn) => fn({ matches: true, media: '(max-width: 768px)' } as MediaQueryListEvent))
    })

    // Critical assertion: NO unintended mobile modal opened after resize!
    expect(screen.queryByTestId('unscheduled-mobile-overlay')).not.toBeInTheDocument()
    expect(screen.queryByTestId('calendar-desktop-sidebar')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')

    // 4. On mobile: explicitly open unscheduled tasks modal
    await user.click(toggleBtn)
    const mobileOverlay = await screen.findByTestId('unscheduled-mobile-overlay')
    expect(mobileOverlay).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')

    // 5. Resize Mobile -> Desktop while mobile modal is open:
    act(() => {
      currentMatches = false
      window.innerWidth = 1024
      listeners.forEach((fn) => fn({ matches: false, media: '(max-width: 768px)' } as MediaQueryListEvent))
    })

    // Critical assertion: Mobile overlay is closed, body scroll lock is restored, desktop sidebar is back
    await waitFor(() => {
      expect(screen.queryByTestId('unscheduled-mobile-overlay')).not.toBeInTheDocument()
    })
    expect(document.body.style.overflow).toBe('')
    expect(screen.getByTestId('calendar-desktop-sidebar')).toBeInTheDocument()

    // Cleanup
    unmount()
    window.matchMedia = originalMatchMedia
  })
})
