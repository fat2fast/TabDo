import React, { useEffect, useRef, useState } from 'react'

export interface TimePicker24hProps {
  value: string // HH:mm (24-hour format)
  onChange: (timeStr: string) => void
  label?: string
  placeholder?: string
  id?: string
  testId?: string
  disabled?: boolean
  className?: string
  required?: boolean
  allowClear?: boolean
}

// 24 Hours: 00 to 23
const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))

// Minutes: in steps of 5 (00, 05, 10, ... 55)
const MINUTES_STEP5 = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

// Common quick presets in 24h
const QUICK_PRESETS_24H = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '14:00',
  '15:00',
  '16:00',
  '18:00',
  '20:00',
]

export function TimePicker24h({
  value,
  onChange,
  label,
  placeholder = 'Chọn giờ (24h)...',
  id,
  testId,
  disabled = false,
  className = '',
  required = false,
  allowClear = false,
}: TimePicker24hProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const [manualInput, setManualInput] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hoursListRef = useRef<HTMLDivElement>(null)
  const minutesListRef = useRef<HTMLDivElement>(null)

  // Parse current hour & minute
  const currentHour = value && value.includes(':') ? value.split(':')[0] : ''
  const currentMinute = value && value.includes(':') ? value.split(':')[1] : ''

  // Smart placement detection & scroll active items into view when opened
  useEffect(() => {
    if (isOpen) {
      setManualInput(value || '')
      setInputError(null)

      if (containerRef.current) {
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
        if (rect.left + 290 > window.innerWidth || rect.left > window.innerWidth / 2) {
          setAlignRight(true)
        } else {
          setAlignRight(false)
        }
      }

      // Slight timeout to ensure DOM rendered
      setTimeout(() => {
        if (hoursListRef.current) {
          const activeHour = hoursListRef.current.querySelector('.time-cell.active') as HTMLElement
          if (activeHour) {
            hoursListRef.current.scrollTop = activeHour.offsetTop - hoursListRef.current.offsetTop - 60
          }
        }
        if (minutesListRef.current) {
          const activeMin = minutesListRef.current.querySelector('.time-cell.active') as HTMLElement
          if (activeMin) {
            minutesListRef.current.scrollTop = activeMin.offsetTop - minutesListRef.current.offsetTop - 60
          }
        }
      }, 50)
    }
  }, [isOpen, value])

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

  const handleSelectHour = (h: string) => {
    const m = currentMinute || '00'
    onChange(`${h}:${m}`)
  }

  const handleSelectMinute = (m: string) => {
    const h = currentHour || '09'
    onChange(`${h}:${m}`)
  }

  const handleQuickPreset = (preset: string) => {
    onChange(preset)
    setIsOpen(false)
  }

  const handleNow = () => {
    const now = new Date()
    const h = String(now.getHours()).padStart(2, '0')
    const rawM = now.getMinutes()
    const roundedM = String(Math.round(rawM / 5) * 5 % 60).padStart(2, '0')
    onChange(`${h}:${roundedM}`)
    setIsOpen(false)
  }

  const handleManualApply = () => {
    const trimmed = manualInput.trim()
    // Matches H:m or HH:mm in 24h (00:00 - 23:59)
    const match = /^([0-1]?[0-9]|2[0-3]):([0-5]?[0-9])$/.exec(trimmed)
    if (match) {
      const h = match[1].padStart(2, '0')
      const m = match[2].padStart(2, '0')
      onChange(`${h}:${m}`)
      setInputError(null)
      setIsOpen(false)
    } else {
      setInputError('Định dạng giờ không hợp lệ (00:00 - 23:59)')
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
      className={`time-picker-24h-container ${className} ${disabled ? 'disabled' : ''}`}
      id={id ? `${id}-wrapper` : undefined}
    >
      {label && <label className="form-label" htmlFor={id}>{label}</label>}

      {/* Accessible native input kept in sync for automated testing and forms */}
      <input
        id={id}
        type="time"
        className="visually-hidden-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label || 'Chọn giờ'}
        tabIndex={-1}
        disabled={disabled}
        required={required}
        data-testid={testId}
      />

      {/* Trigger Button */}
      <div className="time-picker-trigger-wrapper">
        <button
          type="button"
          className={`time-picker-trigger ${value ? 'has-time' : ''} ${isOpen ? 'open' : ''}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          data-testid={testId ? `${testId}-trigger` : undefined}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          <svg
            className="clock-icon"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>

          <span className="trigger-time-text">{value ? `${value}` : placeholder}</span>

          {value && (
            <span className="time-format-badge" title="Định dạng 24 giờ">24h</span>
          )}

          {allowClear && value && (
            <span
              className="clear-time-btn"
              onClick={handleClear}
              title="Xóa giờ"
              role="button"
              tabIndex={0}
            >
              &times;
            </span>
          )}
        </button>
      </div>

      {/* 24-Hour Popover Card */}
      {isOpen && (
        <div
          className={`time-picker-popover-card ${openUpward ? 'open-upward' : ''} ${alignRight ? 'align-right' : ''}`}
          role="dialog"
          aria-label="Bộ chọn giờ 24h"
        >
          {/* Quick Presets */}
          <div className="time-picker-presets-row">
            <span className="section-label">CHỌN NHANH:</span>
            <div className="time-chips-grid">
              {QUICK_PRESETS_24H.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`time-preset-chip ${value === preset ? 'active' : ''}`}
                  onClick={() => handleQuickPreset(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Manual Input Row */}
          <div className="time-manual-input-row">
            <input
              type="text"
              className={`time-manual-input ${inputError ? 'error' : ''}`}
              placeholder="VD: 14:30"
              maxLength={5}
              value={manualInput}
              onChange={(e) => {
                setManualInput(e.target.value)
                if (inputError) setInputError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleManualApply()
                }
              }}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm time-apply-btn"
              onClick={handleManualApply}
            >
              Áp dụng
            </button>
          </div>
          {inputError && <div className="time-input-error-msg">{inputError}</div>}

          {/* 2-Column 24H Picker (Hours & Minutes) */}
          <div className="time-columns-container">
            {/* Hours column */}
            <div className="time-column-wrapper">
              <div className="column-header">Giờ (00 - 23)</div>
              <div className="time-column" ref={hoursListRef}>
                {HOURS_24.map((h) => {
                  const isSelected = currentHour === h
                  return (
                    <button
                      key={h}
                      type="button"
                      className={`time-cell ${isSelected ? 'active' : ''}`}
                      onClick={() => handleSelectHour(h)}
                    >
                      {h}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Minutes column */}
            <div className="time-column-wrapper">
              <div className="column-header">Phút (00 - 55)</div>
              <div className="time-column" ref={minutesListRef}>
                {MINUTES_STEP5.map((m) => {
                  const isSelected = currentMinute === m
                  return (
                    <button
                      key={m}
                      type="button"
                      className={`time-cell ${isSelected ? 'active' : ''}`}
                      onClick={() => handleSelectMinute(m)}
                    >
                      {m}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="time-picker-footer">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleNow}
            >
              Bây giờ
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm btn-done-time"
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
