import React, { useEffect, useRef, useState } from 'react'
import type { DueDateKind } from '@tabdo/types'
import {
  formatDisplayDate,
  getCalendarMonthGrid,
  getDatePickerPresets,
} from '@tabdo/utils'

export interface DatePickerPopoverProps {
  dueDate: string // YYYY-MM-DD
  dueTime: string // HH:mm or ''
  dueDateKind: DueDateKind
  timeZone: string
  onChangeDate: (date: string) => void
  onChangeTime: (time: string) => void
  onChangeKind: (kind: DueDateKind) => void
  onClear?: () => void
  label?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DatePickerPopover({
  dueDate,
  dueTime,
  dueDateKind,
  timeZone,
  onChangeDate,
  onChangeTime,
  onChangeKind,
  onClear,
  label,
  placeholder = 'Chọn hạn chót...',
  disabled = false,
  className = '',
}: DatePickerPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Track viewing year and month for custom calendar
  const currentNow = new Date()
  const initialYear = dueDate && dueDate.length >= 10
    ? parseInt(dueDate.slice(0, 4), 10)
    : currentNow.getFullYear()
  const initialMonth = dueDate && dueDate.length >= 10
    ? parseInt(dueDate.slice(5, 7), 10)
    : currentNow.getMonth() + 1

  const [viewYear, setViewYear] = useState(initialYear)
  const [viewMonth, setViewMonth] = useState(initialMonth)

  // Sync calendar view if dueDate changes externally
  useEffect(() => {
    if (dueDate && dueDate.length >= 10) {
      const y = parseInt(dueDate.slice(0, 4), 10)
      const m = parseInt(dueDate.slice(5, 7), 10)
      if (!isNaN(y) && !isNaN(m)) {
        setViewYear(y)
        setViewMonth(m)
      }
    }
  }, [dueDate])

  // Outside click listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Generate quick presets based on today in the user's timezone
  const { todayStr, tomorrowStr, weekendStr, nextWeekStr } = getDatePickerPresets(timeZone)
  const { cells, monthTitle } = getCalendarMonthGrid(viewYear, viewMonth, timeZone)

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12)
      setViewYear((prev) => prev - 1)
    } else {
      setViewMonth((prev) => prev - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1)
      setViewYear((prev) => prev + 1)
    } else {
      setViewMonth((prev) => prev + 1)
    }
  }

  const applyPreset = (dateStr: string) => {
    onChangeDate(dateStr)
  }

  const applyTimePreset = (timeStr: string) => {
    onChangeTime(timeStr)
    onChangeKind('date_time')
  }

  // Format trigger label text
  let displayLabel = placeholder
  if (dueDate) {
    try {
      const parsedDate = new Date(`${dueDate}T00:00:00`)
      const formattedDate = formatDisplayDate(parsedDate, timeZone, 'dd/MM/yyyy')
      if (dueDate === todayStr) {
        displayLabel = `Hôm nay (${formattedDate})`
      } else if (dueDate === tomorrowStr) {
        displayLabel = `Ngày mai (${formattedDate})`
      } else {
        displayLabel = formattedDate
      }

      if (dueDateKind === 'date_time' && dueTime) {
        displayLabel += ` lúc ${dueTime}`
      } else {
        displayLabel += ` (Cả ngày)`
      }
    } catch {
      displayLabel = dueDate
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChangeDate('')
    onChangeTime('')
    onChangeKind('date_time')
    onClear?.()
    setIsOpen(false)
  }

  return (
    <div
      ref={containerRef}
      className={`date-picker-container ${className} ${disabled ? 'disabled' : ''}`}
    >
      {label && <label className="custom-dropdown-label">{label}</label>}

      {/* Accessible native inputs for test/screen-reader compatibility */}
      <div className="visually-hidden-inputs">
        <input
          id="task-due-date"
          type="date"
          value={dueDate}
          onChange={(e) => onChangeDate(e.target.value)}
          aria-label="Ngày hạn chót"
          tabIndex={-1}
        />
        <input
          id="task-due-time"
          type="time"
          value={dueTime}
          onChange={(e) => onChangeTime(e.target.value)}
          aria-label="Giờ hạn chót"
          tabIndex={-1}
        />
        <label>
          <input
            type="radio"
            name={`due-date-kind-${label || 'hidden'}`}
            checked={dueDateKind === 'date_only'}
            onChange={() => onChangeKind('date_only')}
            tabIndex={-1}
          />
          Đến hạn trong ngày
        </label>
        <label>
          <input
            type="radio"
            name={`due-date-kind-${label || 'hidden'}`}
            checked={dueDateKind === 'date_time'}
            onChange={() => onChangeKind('date_time')}
            tabIndex={-1}
          />
          Giờ cụ thể
        </label>
      </div>

      {/* Trigger Button */}
      <div className="date-picker-trigger-wrapper">
        <button
          type="button"
          className={`date-picker-trigger ${dueDate ? 'has-date' : ''} ${isOpen ? 'open' : ''}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
        >
          <svg
            className="calendar-icon"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>

          <span className="trigger-text">{displayLabel}</span>

          {dueDate && (
            <span
              className="clear-date-btn"
              onClick={handleClear}
              title="Xóa hạn chót"
              role="button"
              tabIndex={0}
            >
              &times;
            </span>
          )}
        </button>
      </div>

      {/* Popover Card */}
      {isOpen && (
        <div className="date-picker-popover-card" role="dialog" aria-label="Bộ chọn ngày giờ">
          {/* Quick Shortcuts */}
          <div className="popover-section shortcuts-section">
            <span className="section-label">CHỌN NHANH:</span>
            <div className="shortcuts-grid">
              <button
                type="button"
                className={`shortcut-chip ${dueDate === todayStr ? 'active' : ''}`}
                onClick={() => applyPreset(todayStr)}
              >
                Hôm nay
              </button>
              <button
                type="button"
                className={`shortcut-chip ${dueDate === tomorrowStr ? 'active' : ''}`}
                onClick={() => applyPreset(tomorrowStr)}
              >
                Ngày mai
              </button>
              <button
                type="button"
                className={`shortcut-chip ${dueDate === weekendStr ? 'active' : ''}`}
                onClick={() => applyPreset(weekendStr)}
              >
                Cuối tuần
              </button>
              <button
                type="button"
                className={`shortcut-chip ${dueDate === nextWeekStr ? 'active' : ''}`}
                onClick={() => applyPreset(nextWeekStr)}
              >
                Tuần sau
              </button>
            </div>
          </div>

          {/* Custom Interactive Monthly Calendar Grid */}
          <div className="popover-section calendar-section">
            <span className="section-label">LỊCH THÁNG:</span>
            <div className="custom-calendar-box">
              <div className="calendar-nav-header">
                <button
                  type="button"
                  className="cal-nav-btn"
                  onClick={handlePrevMonth}
                  aria-label="Tháng trước"
                  title="Tháng trước"
                >
                  &lsaquo;
                </button>
                <span className="cal-month-title">{monthTitle}</span>
                <button
                  type="button"
                  className="cal-nav-btn"
                  onClick={handleNextMonth}
                  aria-label="Tháng sau"
                  title="Tháng sau"
                >
                  &rsaquo;
                </button>
              </div>

              <div className="cal-weekdays-row">
                <span className="cal-weekday">T2</span>
                <span className="cal-weekday">T3</span>
                <span className="cal-weekday">T4</span>
                <span className="cal-weekday">T5</span>
                <span className="cal-weekday">T6</span>
                <span className="cal-weekday">T7</span>
                <span className="cal-weekday">CN</span>
              </div>

              <div className="cal-days-grid">
                {cells.map((cell) => {
                  const isSelected = cell.dateStr === dueDate
                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      className={`cal-day-cell ${
                        !cell.isCurrentMonth ? 'outside-month' : ''
                      } ${cell.isToday ? 'is-today' : ''} ${
                        isSelected ? 'is-selected' : ''
                      }`}
                      onClick={() => {
                        onChangeDate(cell.dateStr)
                        if (!cell.isCurrentMonth) {
                          const cellYear = parseInt(cell.dateStr.slice(0, 4), 10)
                          const cellMonth = parseInt(cell.dateStr.slice(5, 7), 10)
                          setViewYear(cellYear)
                          setViewMonth(cellMonth)
                        }
                      }}
                      title={cell.dateStr}
                    >
                      {cell.dayNumber}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Mode Switcher: Date-only vs Timed */}
          {dueDate && (
            <div className="popover-section">
              <div className="kind-switch-row">
                <label className={`kind-pill ${dueDateKind === 'date_only' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="popover-due-kind"
                    checked={dueDateKind === 'date_only'}
                    onChange={() => {
                      onChangeKind('date_only')
                      onChangeTime('')
                    }}
                  />
                  Đến hạn trong ngày
                </label>
                <label className={`kind-pill ${dueDateKind === 'date_time' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="popover-due-kind"
                    checked={dueDateKind === 'date_time'}
                    onChange={() => onChangeKind('date_time')}
                  />
                  Giờ cụ thể
                </label>
              </div>

              {dueDateKind === 'date_time' && (
                <div className="time-select-area">
                  <div className="time-chips">
                    {['09:00', '12:00', '15:00', '18:00', '21:00'].map((timePreset) => (
                      <button
                        key={timePreset}
                        type="button"
                        className={`time-chip ${dueTime === timePreset ? 'active' : ''}`}
                        onClick={() => applyTimePreset(timePreset)}
                      >
                        {timePreset}
                      </button>
                    ))}
                  </div>

                  <div className="time-input-row">
                    <span className="time-input-label">Giờ:</span>
                    <input
                      type="time"
                      className="popover-time-input"
                      value={dueTime}
                      onChange={(e) => {
                        onChangeTime(e.target.value)
                        onChangeKind('date_time')
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="popover-footer">
            {dueDate && (
              <button
                type="button"
                className="btn-clear-date"
                onClick={handleClear}
              >
                Xóa hạn
              </button>
            )}
            <button
              type="button"
              className="btn-done-date"
              onClick={() => setIsOpen(false)}
            >
              Xong
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
