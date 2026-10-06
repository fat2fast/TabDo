import React, { useState } from 'react'
import { toTaskDueInstant } from '@tabdo/utils'
import type { DueDateKind } from '@tabdo/types'
import { useAuth } from '../../auth/auth-provider'
import { useCategories } from '../hooks/use-categories'
import { useTaskMutations } from '../hooks/use-task-mutations'
import type { TaskPriority } from '../types'
import { CustomDropdown, type DropdownOption } from './ui/custom-dropdown'
import { DatePickerPopover } from './ui/date-picker-popover'

export interface QuickAddTaskProps {
  defaultCategoryId?: string | null
  onTaskCreated?: () => void
}

export function QuickAddTask({ defaultCategoryId, onTaskCreated }: QuickAddTaskProps) {
  const { profile } = useAuth()
  const timeZone = profile?.timezone || 'Asia/Ho_Chi_Minh'
  const { data: categories = [] } = useCategories()
  const { createTaskMutation } = useTaskMutations()

  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [categoryId, setCategoryId] = useState<string>(defaultCategoryId || '')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [dueDateKind, setDueDateKind] = useState<DueDateKind>('date_time')
  const [showOptions, setShowOptions] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const priorityOptions: DropdownOption<TaskPriority>[] = [
    { value: 'low', label: 'Ưu tiên thấp', color: '#64748b' },
    { value: 'medium', label: 'Trung bình', color: '#f59e0b' },
    { value: 'high', label: 'Ưu tiên cao', color: '#ef4444' },
  ]

  const categoryOptions: DropdownOption<string>[] = [
    { value: '', label: 'Không phân loại' },
    ...categories.map((c) => ({
      value: c.id,
      label: c.name,
      color: c.color || '#0284c7',
      icon: c.icon ? <span>{c.icon}</span> : undefined,
    })),
  ]

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    const trimmed = title.trim()
    if (!trimmed) {
      setErrorMessage('Tiêu đề công việc không được để trống.')
      return
    }

    let dueAt: string | null = null
    let resolvedKind: DueDateKind = dueDateKind

    if (dueDate) {
      const timeToUse = dueDateKind === 'date_only' ? null : dueTime
      const instant = toTaskDueInstant(dueDate, timeToUse, timeZone)
      dueAt = instant.dueAt
      resolvedKind = instant.dueDateKind
    }

    try {
      await createTaskMutation.mutateAsync({
        title: trimmed,
        priority,
        categoryId: categoryId || null,
        dueAt,
        dueDateKind: resolvedKind,
      })

      // Success: clear inputs
      setTitle('')
      setPriority('medium')
      setCategoryId(defaultCategoryId || '')
      setDueDate('')
      setDueTime('')
      setDueDateKind('date_time')
      setShowOptions(false)
      setSuccessMessage('Đã tạo công việc thành công!')
      setTimeout(() => setSuccessMessage(null), 3000)
      onTaskCreated?.()
    } catch (err: any) {
      // Failure: preserve values and display error
      setErrorMessage(err.message || 'Không thể tạo công việc. Vui lòng thử lại.')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="quick-add-container card" data-testid="quick-add-task">
      {errorMessage && (
        <div className="alert-error" role="alert">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="alert-success" role="status">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="quick-add-form">
        <div className="quick-add-main-row">
          <input
            type="text"
            className="quick-add-input"
            placeholder="Thêm công việc mới... (Nhấn Enter để lưu)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={createTaskMutation.isPending}
            aria-label="Tiêu đề công việc"
          />

          <button
            type="button"
            className={`quick-add-toggle-btn ${showOptions ? 'active' : ''}`}
            onClick={() => setShowOptions(!showOptions)}
            title="Tùy chọn bổ sung (Hạn chót, Mức độ ưu tiên, Danh mục)"
            aria-label="Mở rộng tùy chọn công việc"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          <button
            type="submit"
            className="quick-add-submit-btn"
            disabled={createTaskMutation.isPending || !title.trim()}
          >
            {createTaskMutation.isPending ? 'Đang thêm...' : 'Thêm'}
          </button>
        </div>

        {showOptions && (
          <div className="quick-add-options-row">
            <div className="option-field">
              <label>Ưu tiên:</label>
              <CustomDropdown
                value={priority}
                options={priorityOptions}
                onChange={setPriority}
                ariaLabel="Mức độ ưu tiên"
                buttonClassName="quick-add-dropdown-btn"
              />
            </div>

            <div className="option-field">
              <label>Danh mục:</label>
              <CustomDropdown
                value={categoryId}
                options={categoryOptions}
                onChange={setCategoryId}
                ariaLabel="Danh mục công việc"
                buttonClassName="quick-add-dropdown-btn"
              />
            </div>

            <div className="option-field date-option-field">
              <label>Hạn chót:</label>
              <DatePickerPopover
                dueDate={dueDate}
                dueTime={dueTime}
                dueDateKind={dueDateKind}
                timeZone={timeZone}
                onChangeDate={setDueDate}
                onChangeTime={setDueTime}
                onChangeKind={setDueDateKind}
                onClear={() => {
                  setDueDate('')
                  setDueTime('')
                }}
              />
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
