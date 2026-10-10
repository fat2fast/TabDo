import React from 'react'
import { addDays, format } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

export interface CalendarToolbarProps {
  view: 'day' | 'week'
  currentDate: string // YYYY-MM-DD
  timeZone: string
  onViewChange: (view: 'day' | 'week') => void
  onDateChange: (dateStr: string) => void
  onAddSchedule: () => void
  isSidebarOpen?: boolean
  onToggleSidebar?: () => void
}

export function CalendarToolbar({
  view,
  currentDate,
  timeZone,
  onViewChange,
  onDateChange,
  onAddSchedule,
  isSidebarOpen,
  onToggleSidebar,
}: CalendarToolbarProps) {
  const dateObj = new Date(currentDate + 'T12:00:00')

  const handlePrev = () => {
    const delta = view === 'day' ? -1 : -7
    const nextDate = addDays(dateObj, delta)
    onDateChange(format(nextDate, 'yyyy-MM-dd'))
  }

  const handleNext = () => {
    const delta = view === 'day' ? 1 : 7
    const nextDate = addDays(dateObj, delta)
    onDateChange(format(nextDate, 'yyyy-MM-dd'))
  }

  const handleToday = () => {
    const todayStr = formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd')
    onDateChange(todayStr)
  }

  // Title formatting
  const displayTitle = React.useMemo(() => {
    if (view === 'day') {
      return formatInTimeZone(dateObj, timeZone, "EEEE, 'ngày' dd 'tháng' MM, yyyy")
    }
    // Week view title: e.g. "Tháng MM, yyyy"
    return formatInTimeZone(dateObj, timeZone, "'Tháng' MM, yyyy")
  }, [view, dateObj, timeZone])

  return (
    <div className="tabdo-calendar-toolbar" data-testid="calendar-toolbar">
      <div className="toolbar-left">
        <button
          type="button"
          className="btn btn-secondary today-btn"
          onClick={handleToday}
          data-testid="calendar-today-btn"
        >
          Hôm nay
        </button>
        <div className="nav-btn-group">
          <button
            type="button"
            className="btn btn-icon nav-btn"
            onClick={handlePrev}
            aria-label="Previous"
            data-testid="calendar-prev-btn"
          >
            ‹
          </button>
          <button
            type="button"
            className="btn btn-icon nav-btn"
            onClick={handleNext}
            aria-label="Next"
            data-testid="calendar-next-btn"
          >
            ›
          </button>
        </div>
        <h2 className="calendar-title" data-testid="calendar-title">
          {displayTitle}
        </h2>
      </div>

      <div className="toolbar-right">
        <div className="view-toggle-group" role="group" aria-label="Calendar view">
          <button
            type="button"
            className={`btn toggle-btn ${view === 'day' ? 'active' : ''}`}
            onClick={() => onViewChange('day')}
            data-testid="view-day-btn"
          >
            Ngày
          </button>
          <button
            type="button"
            className={`btn toggle-btn ${view === 'week' ? 'active' : ''}`}
            onClick={() => onViewChange('week')}
            data-testid="view-week-btn"
          >
            Tuần
          </button>
        </div>

        {onToggleSidebar && (
          <button
            type="button"
            className={`btn toolbar-sidebar-toggle-btn ${isSidebarOpen ? 'active' : ''}`}
            onClick={onToggleSidebar}
            title={isSidebarOpen ? 'Thu gọn danh sách việc cần lên lịch' : 'Mở danh sách việc cần lên lịch'}
            data-testid="toggle-unscheduled-sidebar-btn"
          >
            <span>📋</span>
            <span className="sidebar-toggle-text">Việc cần lên lịch</span>
          </button>
        )}

        <button
          type="button"
          className="btn btn-primary add-schedule-btn"
          onClick={onAddSchedule}
          data-testid="add-schedule-btn"
        >
          <span>+</span> Lên lịch
        </button>
      </div>
    </div>
  )
}
