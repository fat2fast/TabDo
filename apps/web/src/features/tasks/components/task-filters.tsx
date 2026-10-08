import React from 'react'
import { useCategories } from '../hooks/use-categories'
import { useI18n } from '../../i18n/i18n-provider'
import type { TaskPriority, TaskStatus } from '../types'
import { CustomDropdown, type DropdownOption } from './ui/custom-dropdown'

export interface TaskFiltersProps {
  status?: TaskStatus
  priority?: TaskPriority
  categoryId?: string | null
  scope?: string
  onStatusChange: (status: TaskStatus | undefined) => void
  onPriorityChange: (priority: TaskPriority | undefined) => void
  onCategoryChange: (categoryId: string | null | undefined) => void
  onScopeChange?: (scope: string | undefined) => void
  onClear: () => void
  showStatusFilter?: boolean
  showScopeFilter?: boolean
}

export function TaskFilters({
  status,
  priority,
  categoryId,
  scope,
  onStatusChange,
  onPriorityChange,
  onCategoryChange,
  onScopeChange,
  onClear,
  showStatusFilter = true,
  showScopeFilter = false,
}: TaskFiltersProps) {
  const { t } = useI18n()
  const { data: categories = [] } = useCategories()

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

  const hasActiveFilters = Boolean(status || priority || categoryId !== undefined || scope)

  return (
    <div className="task-filters-bar" data-testid="task-filters">
      <div className="filter-bar-lead">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        <span>Lọc:</span>
      </div>

      {showScopeFilter && onScopeChange && (
        <CustomDropdown
          value={scope || ''}
          options={scopeOptions}
          onChange={(val) => onScopeChange(val || undefined)}
          ariaLabel="Lọc phạm vi công việc"
          buttonClassName="filter-dropdown-btn"
          icon={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          }
        />
      )}

      {showStatusFilter && (
        <CustomDropdown
          value={status || ''}
          options={statusOptions}
          onChange={(val) => onStatusChange(val ? (val as TaskStatus) : undefined)}
          ariaLabel="Lọc theo trạng thái"
          buttonClassName="filter-dropdown-btn"
          icon={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 15" />
            </svg>
          }
        />
      )}

      <CustomDropdown
        value={priority || ''}
        options={priorityOptions}
        onChange={(val) => onPriorityChange(val ? (val as TaskPriority) : undefined)}
        ariaLabel="Lọc theo ưu tiên"
        buttonClassName="filter-dropdown-btn"
        icon={
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
        }
      />

      <CustomDropdown
        value={categoryId === null ? 'none' : categoryId || ''}
        options={categoryOptions}
        onChange={(val) => {
          if (val === 'none') onCategoryChange(null)
          else if (val) onCategoryChange(val)
          else onCategoryChange(undefined)
        }}
        ariaLabel="Lọc theo danh mục"
        buttonClassName="filter-dropdown-btn"
        icon={
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
        }
      />

      {hasActiveFilters && (
        <button
          type="button"
          className="btn-clear-filters"
          onClick={onClear}
          title="Xóa tất cả bộ lọc"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Xóa lọc
        </button>
      )}
    </div>
  )
}
