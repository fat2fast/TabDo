import React, { useEffect, useRef, useState } from 'react'

export interface DropdownOption<T = string> {
  value: T
  label: string
  icon?: React.ReactNode
  color?: string
  description?: string
}

export interface CustomDropdownProps<T = string> {
  value: T
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  label?: string
  placeholder?: string
  icon?: React.ReactNode
  ariaLabel?: string
  id?: string
  disabled?: boolean
  className?: string
  buttonClassName?: string
}

export function CustomDropdown<T extends string | null | undefined>({
  value,
  options,
  onChange,
  label,
  placeholder = 'Chọn...',
  icon,
  ariaLabel,
  id,
  disabled = false,
  className = '',
  buttonClassName = '',
}: CustomDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((o) => o.value === value)

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

  const handleSelect = (optionValue: T) => {
    onChange(optionValue)
    setIsOpen(false)
  }

  return (
    <div
      ref={containerRef}
      className={`custom-dropdown-container ${className} ${disabled ? 'disabled' : ''}`}
      id={id}
    >
      {label && <label className="custom-dropdown-label">{label}</label>}

      {/* Accessible native select kept in sync for automated testing and screen-readers */}
      <select
        className="visually-hidden-select"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value as T)}
        aria-label={ariaLabel || label || 'Lựa chọn'}
        tabIndex={-1}
        disabled={disabled}
      >
        {options.map((opt) => (
          <option key={String(opt.value)} value={opt.value ?? ''}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Modern styled trigger button */}
      <button
        type="button"
        className={`custom-dropdown-trigger ${buttonClassName} ${isOpen ? 'open' : ''} ${
          selectedOption?.value ? 'has-value' : ''
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <span className="trigger-content">
          {icon && <span className="trigger-leading-icon">{icon}</span>}
          {selectedOption?.color && (
            <span
              className="option-color-dot"
              style={{ backgroundColor: selectedOption.color }}
            />
          )}
          {selectedOption?.icon && (
            <span className="option-icon">{selectedOption.icon}</span>
          )}
          <span className="trigger-label">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>

        <svg
          className={`chevron-icon ${isOpen ? 'rotated' : ''}`}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div className="custom-dropdown-menu" role="listbox">
          {options.map((opt) => {
            const isSelected = opt.value === value
            return (
              <div
                key={String(opt.value)}
                role="option"
                aria-selected={isSelected}
                className={`dropdown-menu-item ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelect(opt.value)}
              >
                <div className="item-label-group">
                  {opt.color && (
                    <span
                      className="option-color-dot"
                      style={{ backgroundColor: opt.color }}
                    />
                  )}
                  {opt.icon && <span className="option-icon">{opt.icon}</span>}
                  <span className="item-label">{opt.label}</span>
                  {opt.description && (
                    <span className="item-description">{opt.description}</span>
                  )}
                </div>

                {isSelected && (
                  <svg
                    className="check-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
