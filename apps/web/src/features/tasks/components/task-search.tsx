import React, { useEffect, useState } from 'react'
import { useI18n } from '../../i18n/i18n-provider'

export interface TaskSearchProps {
  value: string
  onChange: (value: string) => void
  debounceMs?: number
  placeholder?: string
}

export function TaskSearch({ value, onChange, debounceMs = 300, placeholder }: TaskSearchProps) {
  const { t } = useI18n()
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue)
      }
    }, debounceMs)

    return () => clearTimeout(handler)
  }, [localValue, onChange, debounceMs, value])

  const handleClear = () => {
    setLocalValue('')
    onChange('')
  }

  const effectivePlaceholder = placeholder || t('tasks.searchPlaceholder')

  return (
    <div className="task-search-wrapper" data-testid="task-search">
      <svg
        className="search-icon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        className="task-search-input"
        placeholder={effectivePlaceholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        aria-label={effectivePlaceholder}
      />
      {localValue && (
        <button
          type="button"
          className="search-clear-btn"
          onClick={handleClear}
          aria-label="Xóa tìm kiếm"
        >
          &times;
        </button>
      )}
    </div>
  )
}
