import React, { useId, useMemo } from 'react'
import {
  ORDERED_WEEKDAYS,
  parseRecurrenceRule,
  serializeRecurrenceRule,
} from '@tabdo/utils'
import type { RecurrenceConfig, RecurrenceType, RecurrenceWeekday } from '@tabdo/types'
import { CustomDropdown, DropdownOption } from '../../../components/ui/custom-dropdown'

export interface RecurrenceSelectorProps {
  value: string | null | undefined
  onChange: (newRule: string | null) => void
  hasDueDate: boolean
  isSubtask?: boolean
  disabled?: boolean
  label?: string
}

const VI_WEEKDAY_LABELS: Record<RecurrenceWeekday, string> = {
  MO: 'T2',
  TU: 'T3',
  WE: 'T4',
  TH: 'T5',
  FR: 'T6',
  SA: 'T7',
  SU: 'CN',
}

const REPEAT_OPTIONS: DropdownOption<RecurrenceType>[] = [
  {
    value: 'none',
    label: 'Không lặp lại',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
    ),
  },
  {
    value: 'daily',
    label: 'Hàng ngày',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
    ),
  },
  {
    value: 'weekdays',
    label: 'Ngày trong tuần (T2 - T6)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
  {
    value: 'weekly',
    label: 'Hàng tuần',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    value: 'monthly',
    label: 'Hàng tháng',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <circle cx="12" cy="15" r="2" />
      </svg>
    ),
  },
  {
    value: 'custom',
    label: 'Tùy chỉnh ngày trong tuần',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="17" y1="16" x2="23" y2="16" />
      </svg>
    ),
  },
]

export function RecurrenceSelector({
  value,
  onChange,
  hasDueDate,
  isSubtask = false,
  disabled = false,
  label = 'Lặp lại',
}: RecurrenceSelectorProps) {
  const selectId = useId()

  const config = useMemo<RecurrenceConfig>(() => {
    const parsed = parseRecurrenceRule(value)
    return parsed || { type: 'none' }
  }, [value])

  const handleTypeChange = (newType: RecurrenceType) => {
    if (newType === 'none') {
      onChange(null)
      return
    }

    if (!hasDueDate) {
      return
    }

    if (newType === 'custom') {
      const initialDays: RecurrenceWeekday[] =
        config.days && config.days.length > 0 ? config.days : ['MO']
      onChange(serializeRecurrenceRule({ type: 'custom', days: initialDays }))
    } else {
      onChange(serializeRecurrenceRule({ type: newType }))
    }
  }

  const handleToggleWeekday = (day: RecurrenceWeekday) => {
    if (!hasDueDate || disabled || isSubtask) return
    const currentDays = config.days || []
    let nextDays: RecurrenceWeekday[]
    if (currentDays.includes(day)) {
      nextDays = currentDays.filter((d) => d !== day)
      // Prevent emptying completely; if user unselects all, keep this one or fallback to none
      if (nextDays.length === 0) {
        return
      }
    } else {
      nextDays = [...currentDays, day]
    }
    onChange(serializeRecurrenceRule({ type: 'custom', days: nextDays }))
  }

  if (isSubtask) {
    return (
      <div className="recurrence-selector subtask-disabled flex flex-col gap-1 w-full" data-testid="recurrence-subtask-disabled">
        {label && <label className="prop-label">{label}</label>}
        <span className="text-xs text-slate-400 dark:text-slate-500 italic py-1">
          Công việc phụ không hỗ trợ lặp lại
        </span>
      </div>
    )
  }

  return (
    <div className="recurrence-selector flex flex-col gap-1.5 w-full">
      <CustomDropdown<RecurrenceType>
        id={selectId}
        testId="recurrence-type-select"
        label={label}
        value={config.type}
        options={REPEAT_OPTIONS}
        onChange={handleTypeChange}
        disabled={disabled || !hasDueDate}
        ariaLabel="Chu kỳ lặp lại"
        className="w-full"
      />

      {!hasDueDate && (
        <div
          data-testid="recurrence-no-due-date-error"
          className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium mt-0.5"
        >
          <span>⚠ Cần đặt ngày đến hạn trước khi thiết lập lặp lại</span>
        </div>
      )}

      {hasDueDate && config.type === 'custom' && (
        <div className="custom-weekdays-picker" data-testid="custom-weekdays-picker">
          <span className="picker-hint">
            Chọn các ngày lặp lại trong tuần:
          </span>
          <div className="weekday-pills-row">
            {ORDERED_WEEKDAYS.map((day) => {
              const isSelected = (config.days || []).includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  data-testid={`weekday-toggle-${day}`}
                  disabled={disabled}
                  onClick={() => handleToggleWeekday(day)}
                  className={`weekday-pill-btn ${isSelected ? 'selected' : ''}`}
                  aria-pressed={isSelected}
                  title={`Lặp vào ${VI_WEEKDAY_LABELS[day]}`}
                >
                  {VI_WEEKDAY_LABELS[day]}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
