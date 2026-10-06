import React from 'react'
import type { TaskSortOption } from '../types'
import { CustomDropdown, type DropdownOption } from './ui/custom-dropdown'

export interface TaskSortProps {
  value: TaskSortOption
  onChange: (sort: TaskSortOption) => void
}

export function TaskSort({ value, onChange }: TaskSortProps) {
  const sortOptions: DropdownOption<TaskSortOption>[] = [
    { value: 'default', label: 'Sắp xếp: Mặc định' },
    { value: 'priority', label: 'Ưu tiên (Cao → Thấp)' },
    { value: 'due_asc', label: 'Hạn chót (Gần nhất trước)' },
    { value: 'due_desc', label: 'Hạn chót (Xa nhất trước)' },
    { value: 'created_desc', label: 'Ngày tạo (Mới nhất)' },
    { value: 'updated_desc', label: 'Cập nhật gần nhất' },
  ]

  return (
    <div className="task-sort-wrapper" data-testid="task-sort">
      <CustomDropdown
        value={value}
        options={sortOptions}
        onChange={onChange}
        ariaLabel="Sắp xếp danh sách"
        buttonClassName="sort-dropdown-btn"
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </svg>
        }
      />
    </div>
  )
}
