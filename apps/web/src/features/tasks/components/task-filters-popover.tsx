import React, { useEffect, useRef, useState } from 'react'
import { useCategories } from '../hooks/use-categories'
import { useI18n } from '../../i18n/i18n-provider'
import type { TaskPriority, TaskStatus } from '../types'
import { CustomDropdown, type DropdownOption } from '../../../components/ui/custom-dropdown'

export interface TaskFiltersPopoverProps {
  status?: TaskStatus
  priority?: TaskPriority
  categoryId?: string | null
  scope?: string
  completedRange?: string
  onStatusChange: (status: TaskStatus | undefined) => void
  onPriorityChange: (priority: TaskPriority | undefined) => void
  onCategoryChange: (categoryId: string | null | undefined) => void
  onScopeChange?: (scope: string | undefined) => void
  onCompletedRangeChange?: (range: string | undefined) => void
  onClear: () => void
  showStatusFilter?: boolean
  showScopeFilter?: boolean
  showCompletedFilter?: boolean
}

export function TaskFiltersPopover({
  status,
  priority,
  categoryId,
  scope,
  completedRange,
  onStatusChange,
  onPriorityChange,
  onCategoryChange,
  onScopeChange,
  onCompletedRangeChange,
  onClear,
  showStatusFilter = true,
  showScopeFilter = false,
  showCompletedFilter = false,
}: TaskFiltersPopoverProps) {
  const { t } = useI18n()
  const { data: categories = [] } = useCategories()
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Calculate number of active filters
  const activeCount = [
    Boolean(status),
    Boolean(priority),
    categoryId !== undefined,
    Boolean(scope),
    Boolean(completedRange),
  ].filter(Boolean).length

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
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
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const statusOptions: DropdownOption<string>[] = [
    { value: '', label: 'Tất cả trạng thái' },
    { value: 'todo', label: 'Cần làm', color: '#64748b' },
    { value: 'in_progress', label: 'Đang làm', color: '#0284c7' },
    { value: 'done', label: 'Đã hoàn thành', color: '#16a34a' },
  ]

  const priorityOptions: DropdownOption<string>[] = [
    { value: '', label: 'Tất cả mức ưu tiên' },
    { value: 'high', label: 'Ưu tiên cao', color: '#ef4444' },
    { value: 'medium', label: 'Trung bình', color: '#f59e0b' },
    { value: 'low', label: 'Ưu tiên thấp', color: '#64748b' },
  ]

  const categoryOptions: DropdownOption<string>[] = [
    { value: '', label: 'Tất cả danh mục' },
    { value: 'none', label: 'Chưa phân loại' },
    ...categories.map((c) => ({
      value: c.id,
      label: c.name,
      color: c.color || '#0284c7',
      icon: c.icon ? <span>{c.icon}</span> : undefined,
    })),
  ]

  const scopeOptions: DropdownOption<string>[] = [
    { value: '', label: t('tasks.filterScopeAll') },
    { value: 'unorganized', label: t('tasks.filterScopeUnorganized') },
    { value: 'no_due', label: t('tasks.filterScopeNoDue') },
    { value: 'uncategorized', label: t('tasks.filterScopeUncategorized') },
  ]

  const completedRangeOptions: DropdownOption<string>[] = [
    { value: '', label: 'Tất cả ngày hoàn thành' },
    { value: 'today', label: 'Hoàn thành hôm nay' },
    { value: 'yesterday', label: 'Hoàn thành hôm qua' },
    { value: '7days', label: '7 ngày qua' },
    { value: '30days', label: '30 ngày qua' },
  ]

  return (
    <div className="task-filters-popover-anchor" ref={popoverRef} data-testid="task-filters-popover">
      <button
        type="button"
        className={`btn-filter-trigger ${activeCount > 0 ? 'active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        data-testid="filter-popover-trigger"
        title="Mở bộ lọc công việc"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        <span className="filter-trigger-label">Bộ lọc</span>
        {activeCount > 0 && (
          <span className="filter-count-badge" data-testid="filter-count-badge">
            {activeCount}
          </span>
        )}
      </button>

      {/* Dedicated Filter Modal Popup */}
      <div
        className={`filter-modal-backdrop ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(false)}
        data-testid="filter-modal-backdrop"
        aria-hidden={!isOpen}
      >
          <div
            className="filter-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Bộ lọc công việc"
            onClick={(e) => e.stopPropagation()}
            data-testid="task-filters-modal"
          >
            <div className="filter-modal-header">
              <div className="filter-modal-title-row">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                <h4 className="filter-modal-title">Bộ lọc công việc</h4>
                {activeCount > 0 && (
                  <span className="filter-popover-badge">Đang lọc ({activeCount})</span>
                )}
              </div>
              <button
                type="button"
                className="filter-modal-close-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Đóng bộ lọc"
              >
                &times;
              </button>
            </div>

            <div className="filter-modal-body">
              {showScopeFilter && onScopeChange && (
                <div className="filter-modal-field">
                  <label className="filter-field-label">Phạm vi:</label>
                  <CustomDropdown
                    value={scope || ''}
                    options={scopeOptions}
                    onChange={(val) => onScopeChange(val || undefined)}
                    ariaLabel="Lọc phạm vi công việc"
                    buttonClassName="filter-popover-dropdown-btn"
                    icon={
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                    }
                  />
                </div>
              )}

              {showCompletedFilter && onCompletedRangeChange && (
                <div className="filter-modal-field">
                  <label className="filter-field-label">Thời gian hoàn thành:</label>
                  <CustomDropdown
                    value={completedRange || ''}
                    options={completedRangeOptions}
                    onChange={(val) => onCompletedRangeChange(val || undefined)}
                    ariaLabel="Lọc theo ngày hoàn thành"
                    buttonClassName="filter-popover-dropdown-btn"
                    icon={
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    }
                  />
                </div>
              )}

              {showStatusFilter && (
                <div className="filter-modal-field">
                  <label className="filter-field-label">Trạng thái:</label>
                  <CustomDropdown
                    value={status || ''}
                    options={statusOptions}
                    onChange={(val) => onStatusChange(val ? (val as TaskStatus) : undefined)}
                    ariaLabel="Lọc theo trạng thái"
                    buttonClassName="filter-popover-dropdown-btn"
                    icon={
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="9" />
                        <polyline points="12 7 12 12 15 15" />
                      </svg>
                    }
                  />
                </div>
              )}

              <div className="filter-modal-field">
                <label className="filter-field-label">Mức ưu tiên:</label>
                <CustomDropdown
                  value={priority || ''}
                  options={priorityOptions}
                  onChange={(val) => onPriorityChange(val ? (val as TaskPriority) : undefined)}
                  ariaLabel="Lọc theo ưu tiên"
                  buttonClassName="filter-popover-dropdown-btn"
                  icon={
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                      <line x1="4" y1="22" x2="4" y2="15" />
                    </svg>
                  }
                />
              </div>

              <div className="filter-modal-field filter-modal-field--full">
                <label className="filter-field-label">Danh mục:</label>
                <CustomDropdown
                  value={categoryId === null ? 'none' : categoryId || ''}
                  options={categoryOptions}
                  onChange={(val) => {
                    if (val === 'none') onCategoryChange(null)
                    else if (val) onCategoryChange(val)
                    else onCategoryChange(undefined)
                  }}
                  ariaLabel="Lọc theo danh mục"
                  buttonClassName="filter-popover-dropdown-btn"
                  icon={
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                      <line x1="7" y1="7" x2="7.01" y2="7" />
                    </svg>
                  }
                />
              </div>
            </div>

            <div className="filter-modal-footer">
              {activeCount > 0 ? (
                <button
                  type="button"
                  className="btn-clear-filters"
                  onClick={() => {
                    onClear()
                    setIsOpen(false)
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Xóa tất cả bộ lọc
                </button>
              ) : (
                <span className="filter-no-active-text">Chưa chọn bộ lọc nào</span>
              )}

              <button
                type="button"
                className="btn btn-primary btn-sm btn-filter-done"
                onClick={() => setIsOpen(false)}
              >
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
