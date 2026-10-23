import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  formatDisplayDate,
  getVisibleRangeForDay,
  getVisibleRangeForWeek,
} from '@tabdo/utils'
import { useAuth } from '../features/auth/auth-provider'
import { CalendarToolbar } from '../features/scheduling/components/calendar-toolbar'
import { DayWeekCalendar } from '../features/scheduling/components/day-week-calendar'
import { ScheduleEditor } from '../features/scheduling/components/schedule-editor'
import { ScheduleDetailModal } from '../features/scheduling/components/schedule-detail-modal'
import { UnscheduledTasks } from '../features/scheduling/components/unscheduled-tasks'
import { useScheduleBlockMutations } from '../features/scheduling/hooks/use-schedule-block-mutations'
import { useScheduleBlocksInRange } from '../features/scheduling/hooks/use-schedule-blocks'
import type { ScheduleBlock } from '../features/scheduling/types'
import type { Task } from '../features/tasks/types'
import { TaskDrawer } from '../features/tasks/components/task-drawer'
import { MobileAgenda } from '../features/scheduling/components/mobile-agenda'

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= breakpoint
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    setIsMobile(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [breakpoint])

  return isMobile
}

export function CalendarPage() {
  const { profile } = useAuth()
  const timeZone = profile?.timezone || 'Asia/Ho_Chi_Minh'
  const [searchParams, setSearchParams] = useSearchParams()
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null)

  const todayStr = useMemo(() => {
    return formatDisplayDate(new Date(), timeZone, 'yyyy-MM-dd')
  }, [timeZone])

  const isMobile = useIsMobile(768)

  // Parse and normalize view, date & display from search params
  const rawView = searchParams.get('view')
  const rawDate = searchParams.get('date')
  const rawDisplay = searchParams.get('display')

  const view: 'day' | 'week' = rawView === 'day' ? 'day' : 'week'
  const isValidDate = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
  const currentDate = isValidDate ? rawDate : todayStr

  // Parse optional display; explicit valid value always wins across resizes
  const explicitDisplay = rawDisplay === 'agenda' || rawDisplay === 'grid' ? rawDisplay : null
  const display: 'agenda' | 'grid' = explicitDisplay ?? (isMobile ? 'agenda' : 'grid')

  const handleDisplayChange = useCallback(
    (newDisplay: 'agenda' | 'grid') => {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.set('display', newDisplay)
      setSearchParams(nextParams)
    },
    [searchParams, setSearchParams]
  )

  // Normalize URL parameters if invalid or missing
  useEffect(() => {
    let shouldUpdate = false
    const newParams = new URLSearchParams(searchParams)

    if (rawView !== 'day' && rawView !== 'week') {
      newParams.set('view', 'week')
      shouldUpdate = true
    }
    if (!isValidDate) {
      newParams.set('date', todayStr)
      shouldUpdate = true
    }

    if (shouldUpdate) {
      setSearchParams(newParams, { replace: true })
    }
  }, [rawView, rawDate, isValidDate, todayStr, searchParams, setSearchParams])

  // Derive visible UTC range [start, end)
  const visibleRange = useMemo(() => {
    if (view === 'day') {
      return getVisibleRangeForDay(currentDate, timeZone)
    }
    return getVisibleRangeForWeek(currentDate, timeZone)
  }, [view, currentDate, timeZone])

  // Fetch schedule blocks intersecting the visible range
  const {
    data: scheduleBlocks = [],
    isLoading,
    error: queryError,
  } = useScheduleBlocksInRange({
    startAt: visibleRange.startAt,
    endAt: visibleRange.endAt,
  })

  const { updateMutation } = useScheduleBlockMutations()

  // Modal editor & detail state
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<ScheduleBlock | null>(null)
  const [viewingBlock, setViewingBlock] = useState<ScheduleBlock | null>(null)
  const [editorStartAt, setEditorStartAt] = useState<string | undefined>()
  const [editorEndAt, setEditorEndAt] = useState<string | undefined>()
  const [editorTask, setEditorTask] = useState<Task | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)

  // Navigation callbacks
  const handleViewChange = useCallback(
    (newView: 'day' | 'week') => {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.set('view', newView)
      setSearchParams(nextParams)
    },
    [searchParams, setSearchParams]
  )

  const handleDateChange = useCallback(
    (newDate: string) => {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.set('date', newDate)
      setSearchParams(nextParams)
    },
    [searchParams, setSearchParams]
  )

  // Open editor for adding new schedule
  const handleOpenAddSchedule = () => {
    setViewingBlock(null)
    setEditingBlock(null)
    setEditorStartAt(undefined)
    setEditorEndAt(undefined)
    setEditorTask(null)
    setIsEditorOpen(true)
    setMutationError(null)
  }

  // Open editor from slot selection
  const handleSelectSlot = ({
    startAt,
    endAt,
  }: {
    startAt: string
    endAt: string
    isAllDay?: boolean
  }) => {
    setViewingBlock(null)
    setEditingBlock(null)
    setEditorStartAt(startAt)
    setEditorEndAt(endAt)
    setEditorTask(null)
    setIsEditorOpen(true)
    setMutationError(null)
  }

  // Open detail view from event click (Info List modal)
  const handleEventClick = (block: ScheduleBlock) => {
    setViewingBlock(block)
    setMutationError(null)
  }

  // Open editor pre-linked to an unscheduled task
  const handleScheduleTask = (task: Task) => {
    setEditingBlock(null)
    setEditorStartAt(undefined)
    setEditorEndAt(undefined)
    setEditorTask(task)
    setIsEditorOpen(true)
    setMutationError(null)
  }

  // Move event (drag and drop)
  const handleEventDrop = async ({
    block,
    newStartAt,
    newEndAt,
    revert,
  }: {
    block: ScheduleBlock
    newStartAt: string
    newEndAt: string
    revert: () => void
  }) => {
    setMutationError(null)
    try {
      await updateMutation.mutateAsync({
        id: block.id,
        input: {
          startAt: newStartAt,
          endAt: newEndAt,
          previousUpdatedAt: block.updatedAt,
        },
      })
    } catch (err: any) {
      revert()
      setMutationError(
        err.message || 'Không thể di chuyển lịch trình do xung đột cập nhật hoặc lỗi kết nối.'
      )
    }
  }

  // Resize event
  const handleEventResize = async ({
    block,
    newStartAt,
    newEndAt,
    revert,
  }: {
    block: ScheduleBlock
    newStartAt: string
    newEndAt: string
    revert: () => void
  }) => {
    setMutationError(null)
    try {
      await updateMutation.mutateAsync({
        id: block.id,
        input: {
          startAt: newStartAt,
          endAt: newEndAt,
          previousUpdatedAt: block.updatedAt,
        },
      })
    } catch (err: any) {
      revert()
      setMutationError(
        err.message || 'Không thể thay đổi thời lượng do xung đột cập nhật hoặc lỗi kết nối.'
      )
    }
  }

  // Sidebar state (default open on desktop, collapsed on mobile)
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile)
  const unscheduledPanelRef = useRef<HTMLDivElement>(null)
  const unscheduledTriggerRef = useRef<HTMLElement | null>(null)

  // Manage mobile unscheduled tasks dialog lifecycle
  useEffect(() => {
    if (isSidebarOpen && isMobile) {
      unscheduledTriggerRef.current = document.activeElement as HTMLElement | null
      const prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'

      requestAnimationFrame(() => {
        const first = unscheduledPanelRef.current?.querySelector<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])'
        )
        first?.focus()
      })

      return () => {
        document.body.style.overflow = prevOverflow
        unscheduledTriggerRef.current?.focus?.()
      }
    }
  }, [isSidebarOpen, isMobile])

  // Support Escape hotkey and Tab focus trap for mobile unscheduled tasks dialog
  useEffect(() => {
    if (!isSidebarOpen || !isMobile) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        const hasTopOverlay = document.querySelector(
          '.confirm-dialog-backdrop, .custom-dropdown-menu.open, .date-picker-popover-content, .modal-backdrop'
        )
        if (hasTopOverlay) return
        setIsSidebarOpen(false)
        return
      }

      if (e.key === 'Tab' && unscheduledPanelRef.current) {
        const focusables = unscheduledPanelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return

        const first = focusables[0]
        const last = focusables[focusables.length - 1]

        if (!unscheduledPanelRef.current.contains(document.activeElement)) {
          e.preventDefault()
          first.focus()
          return
        }

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSidebarOpen, isMobile])

  return (
    <div className="tabdo-calendar-page-layout" data-testid="calendar-page">
      <CalendarToolbar
        view={view}
        display={display}
        currentDate={currentDate}
        timeZone={timeZone}
        onViewChange={handleViewChange}
        onDisplayChange={handleDisplayChange}
        onDateChange={handleDateChange}
        onAddSchedule={handleOpenAddSchedule}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      />

      {mutationError && (
        <div className="calendar-error-banner" role="alert" data-testid="calendar-mutation-error">
          <span>⚠️ {mutationError}</span>
          <button
            type="button"
            className="banner-close-btn"
            onClick={() => setMutationError(null)}
          >
            ✕
          </button>
        </div>
      )}

      {queryError && (
        <div className="calendar-error-banner" role="alert">
          <span>⚠️ Không thể tải danh sách lịch trình: {(queryError as any).message}</span>
        </div>
      )}

      <div className={`calendar-page-body ${isSidebarOpen ? '' : 'sidebar-collapsed'}`}>
        <div className="calendar-main-content">
          {isLoading ? (
            <div className="calendar-loading-overlay">Đang tải lịch trình...</div>
          ) : display === 'agenda' ? (
            <MobileAgenda
              blocks={scheduleBlocks}
              visibleRange={visibleRange}
              timeZone={timeZone}
              onEventClick={handleEventClick}
              onAddSchedule={handleOpenAddSchedule}
            />
          ) : (
            <DayWeekCalendar
              events={scheduleBlocks}
              view={view}
              currentDate={currentDate}
              timeZone={timeZone}
              onSelectSlot={handleSelectSlot}
              onEventClick={handleEventClick}
              onEventDrop={handleEventDrop}
              onEventResize={handleEventResize}
            />
          )}
        </div>

        {isSidebarOpen && !isMobile && (
          <aside className="calendar-sidebar">
            <UnscheduledTasks
              onScheduleTask={handleScheduleTask}
              onClose={() => setIsSidebarOpen(false)}
            />
          </aside>
        )}
      </div>

      {isSidebarOpen && isMobile && (
        <div
          className="unscheduled-sidebar-mobile-overlay"
          onClick={() => setIsSidebarOpen(false)}
        >
          <div
            ref={unscheduledPanelRef}
            className="unscheduled-sidebar-mobile-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Việc cần lên lịch"
          >
            <div className="unscheduled-mobile-header">
              <span className="unscheduled-mobile-title">Việc cần lên lịch</span>
              <button
                type="button"
                className="btn btn-icon unscheduled-mobile-close-btn"
                onClick={() => setIsSidebarOpen(false)}
                aria-label="Đóng danh sách việc cần lên lịch"
              >
                ✕
              </button>
            </div>
            <UnscheduledTasks
              onScheduleTask={handleScheduleTask}
              onClose={() => setIsSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      <ScheduleDetailModal
        isOpen={Boolean(viewingBlock)}
        block={viewingBlock}
        onClose={() => setViewingBlock(null)}
        onEdit={(block) => {
          setViewingBlock(null)
          setEditingBlock(block)
          setEditorStartAt(block.startAt)
          setEditorEndAt(block.endAt)
          setEditorTask(null)
          setIsEditorOpen(true)
        }}
        onDeleted={() => {
          setViewingBlock(null)
        }}
        onOpenTaskDetail={(taskId) => {
          setViewingBlock(null)
          setDrawerTaskId(taskId)
        }}
      />

      <ScheduleEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        initialBlock={editingBlock}
        initialStartAt={editorStartAt}
        initialEndAt={editorEndAt}
        initialTask={editorTask}
        onOpenTaskDetail={(taskId) => {
          setIsEditorOpen(false)
          setDrawerTaskId(taskId)
        }}
      />

      <TaskDrawer
        taskId={drawerTaskId}
        onClose={() => setDrawerTaskId(null)}
      />
    </div>
  )
}
