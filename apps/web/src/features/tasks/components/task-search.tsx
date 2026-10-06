import React, { useEffect, useState } from 'react'

export interface TaskSearchProps {
  value: string
  onChange: (value: string) => void
  debounceMs?: number
}

export function TaskSearch({ value, onChange, debounceMs = 300 }: TaskSearchProps) {
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
        placeholder="Tìm kiếm theo tiêu đề..."
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        aria-label="Tìm kiếm công việc"
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
