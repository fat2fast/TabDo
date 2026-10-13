import React, { useMemo, useState } from 'react'
import {
  formatRecurrenceRuleSummary,
  formatTaskDueDate,
  isTaskOverdue,
} from '@tabdo/utils'
import { useAuth } from '../../auth/auth-provider'
import { useCategories } from '../hooks/use-categories'
import type { Task, TaskStatus } from '../types'
import { extractTaskChecklist } from '../utils/task-checklist'

export interface TaskBoardCardProps {
  task: Task
  onSelect: (taskId: string) => void
  onStatusChange?: (task: Task, newStatus: TaskStatus) => void
  isPending?: boolean
}

export function TaskBoardCard({
  task,
  onSelect,
  isPending = false,
}: TaskBoardCardProps) {
  const { profile } = useAuth()
  const timeZone = profile?.timezone || 'Asia/Ho_Chi_Minh'
  const { data: categories = [] } = useCategories()
  const [isDragging, setIsDragging] = useState(false)

  const category = categories.find((c) => c.id === task.categoryId)
  const isOverdue = isTaskOverdue(task.dueAt, task.status, new Date())

  // Checklist stats from task description
  const checklistStats = useMemo(() => {
    const items = extractTaskChecklist(task.description)
    if (items.length === 0) return null
    const done = items.filter((i) => i.completed).length
    return { total: items.length, done }
  }, [task.description])

  const recurrenceSummary = useMemo(() => {
    return task.recurrenceRule ? formatRecurrenceRuleSummary(task.recurrenceRule) : null
  }, [task.recurrenceRule])

  const handleCardClick = () => {
    onSelect(task.id)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(task.id)
    }
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (isPending) {
      e.preventDefault()
      return
    }
    setIsDragging(true)
    e.dataTransfer.setData('text/plain', task.id)
    e.dataTransfer.setData('application/json', JSON.stringify(task))
    e.dataTransfer.effectAllowed = 'move'

  }

  const handleDragEnd = () => {
    setIsDragging(false)
  }

  const priorityLabelMap: Record<string, string> = {
    high: 'Cao',
    medium: 'Trung bình',
    low: 'Thấp',
  }

  return (
    <div
      className={`task-board-card ${isDragging ? 'task-board-card--dragging' : ''} ${
        isPending ? 'task-board-card--pending' : ''
      }`}
      data-testid={`task-board-card-${task.id}`}
      draggable={!isPending}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${task.title}, trạng thái ${task.status}`}
    >
      <div className="task-board-card-header">
        <h4 className="task-board-card-title">{task.title}</h4>
        {isPending && (
          <span className="task-board-card-spinner" aria-label="Đang cập nhật..." />
        )}
      </div>

      <div className="task-board-card-metadata">
        {/* Category Badge */}
        {category && (
          <span
            className="task-board-card-category-badge"
            style={{
              backgroundColor: category.color ? `${category.color}20` : 'var(--badge-bg)',
              color: category.color || 'var(--badge-text)',
              borderColor: category.color ? `${category.color}40` : 'transparent',
            }}
          >
            {category.name}
          </span>
        )}

        {/* Priority Badge */}
        <span className={`task-board-card-priority-badge priority-${task.priority}`}>
          {priorityLabelMap[task.priority] || task.priority}
        </span>

        {/* Recurrence Indicator */}
        {recurrenceSummary && (
          <span
            className="task-board-card-recurrence-badge"
            title={`Lặp lại: ${recurrenceSummary}`}
          >
            <svg
              className="recurrence-icon"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            <span className="recurrence-text">{recurrenceSummary}</span>
          </span>
        )}

        {/* Due Date */}
        {task.dueAt && (
          <span
            className={`task-board-card-due-badge ${isOverdue ? 'overdue' : ''}`}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {formatTaskDueDate(task.dueAt, task.dueDateKind, timeZone)}
          </span>
        )}

        {/* Checklist Progress */}
        {checklistStats && (
          <span className="task-board-card-checklist-badge" title="Tiến độ checklist">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            {checklistStats.done}/{checklistStats.total}
          </span>
        )}
      </div>
    </div>
  )
}
