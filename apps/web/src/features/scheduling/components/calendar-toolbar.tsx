import React from 'react'
import { addDays, format } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { vi, enUS } from 'date-fns/locale'
import { useI18n } from '../../i18n/i18n-provider'

export interface CalendarToolbarProps {
  view: 'day' | 'week'
  display?: 'agenda' | 'grid'
  currentDate: string // YYYY-MM-DD
  timeZone: string
  onViewChange: (view: 'day' | 'week') => void
  onDisplayChange?: (display: 'agenda' | 'grid') => void
  onDateChange: (dateStr: string) => void
  onAddSchedule: () => void
  isSidebarOpen?: boolean
  onToggleSidebar?: () => void
}

export function CalendarToolbar({
  view,
  display = 'grid',
  currentDate,
  timeZone,
  onViewChange,
  onDisplayChange,
  onDateChange,
  onAddSchedule,
  isSidebarOpen,
  onToggleSidebar,
}: CalendarToolbarProps) {
  const { locale } = useI18n()
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
      return formatInTimeZone(dateObj, timeZone, locale === 'vi' ? "EEEE, 'ngày' dd 'tháng' MM, yyyy" : 'EEEE, MMMM d, yyyy', { locale: locale === 'vi' ? vi : enUS })
    }
    // Week view title: e.g. "Tháng MM, yyyy"
    return formatInTimeZone(dateObj, timeZone, locale === 'vi' ? "'Tháng' MM, yyyy" : 'MMMM yyyy', { locale: locale === 'vi' ? vi : enUS })
  }, [view, dateObj, timeZone, locale])

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
            aria-pressed={view === 'day'}
            onClick={() => onViewChange('day')}
            data-testid="view-day-btn"
          >
            Ngày
          </button>
          <button
            type="button"
            className={`btn toggle-btn ${view === 'week' ? 'active' : ''}`}
            aria-pressed={view === 'week'}
            onClick={() => onViewChange('week')}
            data-testid="view-week-btn"
          >
            Tuần
          </button>
        </div>

        {onDisplayChange && (
          <div className="display-toggle-group" role="group" aria-label="Chế độ hiển thị" data-testid="display-toggle-group">
            <button
              type="button"
              className={`btn toggle-btn ${display === 'agenda' ? 'active' : ''}`}
              aria-pressed={display === 'agenda'}
              onClick={() => onDisplayChange('agenda')}
              data-testid="display-agenda-btn"
              title="Chế độ Danh sách lịch (Agenda)"
            >
              Agenda
            </button>
            <button
              type="button"
              className={`btn toggle-btn ${display !== 'agenda' ? 'active' : ''}`}
              aria-pressed={display === 'grid'}
              onClick={() => onDisplayChange('grid')}
              data-testid="display-grid-btn"
              title="Chế độ Lưới (Grid)"
            >
              Lưới
            </button>
          </div>
        )}

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
