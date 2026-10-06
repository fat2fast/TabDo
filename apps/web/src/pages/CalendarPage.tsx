import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
import { UnscheduledTasks } from '../features/scheduling/components/unscheduled-tasks'
import { useScheduleBlockMutations } from '../features/scheduling/hooks/use-schedule-block-mutations'
import { useScheduleBlocksInRange } from '../features/scheduling/hooks/use-schedule-blocks'
import type { ScheduleBlock } from '../features/scheduling/types'
import type { Task } from '../features/tasks/types'

export function CalendarPage() {
  const { profile } = useAuth()
  const timeZone = profile?.timezone || 'Asia/Ho_Chi_Minh'
  const [searchParams, setSearchParams] = useSearchParams()

  const todayStr = useMemo(() => {
    return formatDisplayDate(new Date(), timeZone, 'yyyy-MM-dd')
  }, [timeZone])

  // Parse and normalize view & date from search params
  const rawView = searchParams.get('view')
  const rawDate = searchParams.get('date')

  const view: 'day' | 'week' = rawView === 'day' ? 'day' : 'week'
  const isValidDate = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
  const currentDate = isValidDate ? rawDate : todayStr

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

  // Modal editor state
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<ScheduleBlock | null>(null)
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
    setEditingBlock(null)
    setEditorStartAt(undefined)
    setEditorEndAt(undefined)
    setEditorTask(null)
    setIsEditorOpen(true)
    setMutationError(null)
  }

  // Open editor from slot selection
  const handleSelectSlot = ({ startAt, endAt }: { startAt: string; endAt: string }) => {
    setEditingBlock(null)
    setEditorStartAt(startAt)
    setEditorEndAt(endAt)
    setEditorTask(null)
    setIsEditorOpen(true)
    setMutationError(null)
  }

  // Open editor from event click
  const handleEventClick = (block: ScheduleBlock) => {
    setEditingBlock(block)
    setEditorStartAt(block.startAt)
    setEditorEndAt(block.endAt)
    setEditorTask(null)
    setIsEditorOpen(true)
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

  // Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  return (
    <div className="tabdo-calendar-page-layout" data-testid="calendar-page">
      <CalendarToolbar
        view={view}
        currentDate={currentDate}
        timeZone={timeZone}
        onViewChange={handleViewChange}
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

        {isSidebarOpen && (
          <aside className="calendar-sidebar">
            <UnscheduledTasks
              onScheduleTask={handleScheduleTask}
              onClose={() => setIsSidebarOpen(false)}
            />
          </aside>
        )}
      </div>

      <ScheduleEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        initialBlock={editingBlock}
        initialStartAt={editorStartAt}
        initialEndAt={editorEndAt}
        initialTask={editorTask}
      />
    </div>
  )
}
