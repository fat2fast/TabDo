import React, { useEffect, useRef, useState } from 'react'
import {
  formatDisplayDate,
  getCalendarMonthGrid,
  getDatePickerPresets,
} from '@tabdo/utils'

export interface DatePickerProps {
  value: string // YYYY-MM-DD
  onChange: (dateStr: string) => void
  label?: string
  placeholder?: string
  timeZone?: string
  id?: string
  testId?: string
  disabled?: boolean
  className?: string
  allowClear?: boolean
  required?: boolean
}

export function DatePicker({
  value,
  onChange,
  label,
  placeholder = 'Chọn ngày...',
  timeZone = 'Asia/Ho_Chi_Minh',
  id,
  testId,
  disabled = false,
  className = '',
  allowClear = false,
  required = false,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentNow = new Date()
  const initialYear = value && value.length >= 10
    ? parseInt(value.slice(0, 4), 10)
    : currentNow.getFullYear()
  const initialMonth = value && value.length >= 10
    ? parseInt(value.slice(5, 7), 10)
    : currentNow.getMonth() + 1

  const [viewYear, setViewYear] = useState(initialYear)
  const [viewMonth, setViewMonth] = useState(initialMonth)

  // Smart placement detection
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top

      // If space below is less than 380px and there is more space above, open upward
      if (spaceBelow < 380 && spaceAbove > spaceBelow) {
        setOpenUpward(true)
      } else {
        setOpenUpward(false)
      }

      // Align right if near the right edge of viewport or on right half of screen
      if (rect.left + 320 > window.innerWidth || rect.left > window.innerWidth / 2) {
        setAlignRight(true)
      } else {
        setAlignRight(false)
      }
    }
  }, [isOpen])

  // Sync calendar view when value changes externally
  useEffect(() => {
    if (value && value.length >= 10) {
      const y = parseInt(value.slice(0, 4), 10)
      const m = parseInt(value.slice(5, 7), 10)
      if (!isNaN(y) && !isNaN(m)) {
        setViewYear(y)
        setViewMonth(m)
      }
    }
  }, [value])

  // Close on outside click
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

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown, true)
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isOpen])

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
    onChange(dateStr)
    setIsOpen(false)
  }

  const handleSelectDate = (dateStr: string) => {
    onChange(dateStr)
    setIsOpen(false)
  }

  // Format trigger display text
  let displayLabel = placeholder
  if (value) {
    try {
      const parsedDate = new Date(`${value}T00:00:00`)
      const formattedDate = formatDisplayDate(parsedDate, timeZone, 'dd/MM/yyyy')
      if (value === todayStr) {
        displayLabel = `Hôm nay (${formattedDate})`
      } else if (value === tomorrowStr) {
        displayLabel = `Ngày mai (${formattedDate})`
      } else {
        displayLabel = formattedDate
      }
    } catch {
      displayLabel = value
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setIsOpen(false)
  }

  return (
    <div
      ref={containerRef}
      className={`date-picker-container ${className} ${disabled ? 'disabled' : ''}`}
      id={id ? `${id}-wrapper` : undefined}
    >
      {label && <label className="form-label" htmlFor={id}>{label}</label>}

      {/* Accessible native input kept in sync for automated testing and forms */}
      <input
        id={id}
        type="date"
        className="visually-hidden-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label || 'Chọn ngày'}
        tabIndex={-1}
        disabled={disabled}
        required={required}
        data-testid={testId}
      />

      {/* Modern styled trigger button */}
      <div className="date-picker-trigger-wrapper">
        <button
          type="button"
          className={`date-picker-trigger ${value ? 'has-date' : ''} ${isOpen ? 'open' : ''}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          data-testid={testId ? `${testId}-trigger` : undefined}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
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

          {allowClear && value && (
            <span
              className="clear-date-btn"
              onClick={handleClear}
              title="Xóa ngày"
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
        <div
          className={`date-picker-popover-card ${openUpward ? 'open-upward' : ''} ${alignRight ? 'align-right' : ''}`}
          role="dialog"
          aria-label="Bộ chọn ngày"
        >
          {/* Quick Shortcuts */}
          <div className="popover-section shortcuts-section">
            <span className="section-label">CHỌN NHANH:</span>
            <div className="shortcuts-grid">
              <button
                type="button"
                className={`shortcut-chip ${value === todayStr ? 'active' : ''}`}
                onClick={() => applyPreset(todayStr)}
              >
                Hôm nay
              </button>
              <button
                type="button"
                className={`shortcut-chip ${value === tomorrowStr ? 'active' : ''}`}
                onClick={() => applyPreset(tomorrowStr)}
              >
                Ngày mai
              </button>
              <button
                type="button"
                className={`shortcut-chip ${value === weekendStr ? 'active' : ''}`}
                onClick={() => applyPreset(weekendStr)}
              >
                Cuối tuần
              </button>
              <button
                type="button"
                className={`shortcut-chip ${value === nextWeekStr ? 'active' : ''}`}
                onClick={() => applyPreset(nextWeekStr)}
              >
                Tuần sau
              </button>
            </div>
          </div>

          {/* Interactive Monthly Calendar Grid */}
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
                  const isSelected = cell.dateStr === value
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
                        handleSelectDate(cell.dateStr)
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

          <div className="popover-footer">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                onChange(todayStr)
                setIsOpen(false)
              }}
            >
              Hôm nay
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm btn-done-date"
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
