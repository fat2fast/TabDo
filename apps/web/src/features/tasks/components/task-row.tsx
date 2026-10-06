import React, { useMemo } from 'react'
import { formatTaskDueDate, isTaskOverdue } from '@tabdo/utils'
import { useAuth } from '../../auth/auth-provider'
import { useCategories } from '../hooks/use-categories'
import { useTaskMutations } from '../hooks/use-task-mutations'
import { useSubtasks } from '../hooks/use-tasks'
import type { Task } from '../types'
import { extractTaskAttachments } from '../utils/task-attachments'
import { extractTaskChecklist } from '../utils/task-checklist'
import { extractLinkedTaskIds } from '../utils/task-linking'
import { useConfirm } from '../../../components/ui'

export interface TaskRowProps {
  task: Task
  onSelect: (taskId: string) => void
  subtaskCount?: number
}

export function TaskRow({ task, onSelect, subtaskCount }: TaskRowProps) {
  const { profile } = useAuth()
  const timeZone = profile?.timezone || 'Asia/Ho_Chi_Minh'
  const { data: categories = [] } = useCategories()
  const { completeTaskMutation, reopenTaskMutation, deleteTaskMutation } = useTaskMutations()
  const { data: subtasks = [] } = useSubtasks(task.parentId ? null : task.id)
  const confirm = useConfirm()

  const isCompleted = task.status === 'done'
  const isOverdue = isTaskOverdue(task.dueAt, task.status, new Date())
  const category = categories.find((c) => c.id === task.categoryId)
  const isPending = completeTaskMutation.isPending || reopenTaskMutation.isPending || deleteTaskMutation.isPending

  const totalSubtasks = subtaskCount ?? subtasks.length
  const doneSubtasks = subtasks.filter((s) => s.status === 'done').length

  // Parse checklist progress from task description (supports modern decoupled comment and legacy markdown)
  const checklistStats = useMemo(() => {
    const items = extractTaskChecklist(task.description)
    if (items.length === 0) return null
    const done = items.filter((i) => i.completed).length
    return { total: items.length, done }
  }, [task.description])

  // Attachments count
  const attachmentsCount = useMemo(() => {
    return extractTaskAttachments(task.description).length
  }, [task.description])

  // Linked tasks count
  const linkedCount = useMemo(() => {
    return extractLinkedTaskIds(task.description).length
  }, [task.description])

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    if (isCompleted) {
      reopenTaskMutation.mutate(task)
    } else {
      completeTaskMutation.mutate(task)
    }
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const confirmed = await confirm({
      title: 'Xóa công việc?',
      message: (
        <span>
          Bạn có chắc chắn muốn xóa công việc <strong>"{task.title}"</strong>? Các công việc con và dữ liệu liên quan cũng sẽ bị xóa vĩnh viễn.
        </span>
      ),
      confirmText: 'Xóa công việc',
      cancelText: 'Hủy',
      variant: 'danger',
    })
    if (confirmed) {
      deleteTaskMutation.mutate({ id: task.id, parentId: task.parentId })
    }
  }

  const priorityLabelMap: Record<string, string> = {
    high: 'Ưu tiên cao',
    medium: 'Trung bình',
    low: 'Ưu tiên thấp',
  }

  return (
    <div
      className={`task-row ${isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue' : ''} ${
        task.parentId ? 'is-subtask' : ''
      }`}
      onClick={() => onSelect(task.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(task.id)
        }
      }}
      data-testid={`task-row-${task.id}`}
    >
      {/* Left Checkbox */}
      <div className="task-row-checkbox-col" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isCompleted}
          onChange={handleCheckboxChange}
          disabled={isPending}
          aria-label={`Đánh dấu hoàn thành: ${task.title}`}
          className="task-checkbox"
        />
      </div>

      {/* Center Main Info */}
      <div className="task-row-content">
        <div className="task-title-line">
          <span className={`task-title ${isCompleted ? 'line-through' : ''}`}>
            {task.parentId && <span className="title-subtask-branch" aria-hidden="true">↳ </span>}
            {task.title}
          </span>
        </div>

        <div className="task-row-meta">
          {task.parentId && (
            <span className="task-badge subtask-child-badge" title="Công việc con">
              <span className="subtask-arrow">↳</span> Việc con
            </span>
          )}

          {category && (
            <span
              className="task-badge category-badge"
              style={{
                borderColor: category.color || '#cbd5e1',
                backgroundColor: category.color ? `${category.color}15` : '#f1f5f9',
                color: category.color || '#0f172a',
              }}
            >
              {category.icon && <span className="cat-icon">{category.icon}</span>}
              {category.name}
            </span>
          )}

          <span className={`task-badge priority-badge priority-${task.priority}`}>
            {priorityLabelMap[task.priority] || task.priority}
          </span>

          {/* Subtasks Progress */}
          {!task.parentId && totalSubtasks > 0 && (
            <span
              className="task-badge subtask-badge"
              title={`Tiến độ việc con: ${doneSubtasks}/${totalSubtasks}`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 11 12 14 22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              {doneSubtasks > 0 ? `${doneSubtasks}/${totalSubtasks} việc con` : `${totalSubtasks} việc con`}
            </span>
          )}

          {/* Checklist Progress */}
          {checklistStats && (
            <span
              className={`task-badge checklist-badge ${checklistStats.done === checklistStats.total ? 'checklist-all-done' : ''}`}
              title={`Mục checklist: ${checklistStats.done}/${checklistStats.total}`}
            >
              ☑ {checklistStats.done}/{checklistStats.total}
            </span>
          )}

          {/* Attachments Count */}
          {attachmentsCount > 0 && (
            <span className="task-badge attachment-badge" title={`${attachmentsCount} tệp đính kèm`}>
              📎 {attachmentsCount}
            </span>
          )}

          {/* Linked Tasks Count */}
          {linkedCount > 0 && (
            <span className="task-badge linked-badge" title={`${linkedCount} công việc liên kết`}>
              🔗 {linkedCount}
            </span>
          )}

          {/* Source URL badge */}
          {task.sourceUrl && (
            <a
              href={task.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="task-badge source-url-badge"
              title={task.sourceUrl}
            >
              🔗 Nguồn
            </a>
          )}
        </div>
      </div>

      {/* Right Column: Schedule / Due Date & Quick Actions */}
      <div className="task-row-right-col" onClick={(e) => e.stopPropagation()}>
        {task.dueAt ? (
          <div
            className={`task-due-chip ${isOverdue ? 'due-overdue' : ''}`}
            title={`Hạn chót: ${formatTaskDueDate(task.dueAt, task.dueDateKind, timeZone)}`}
            onClick={() => onSelect(task.id)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="due-chip-text">
              {formatTaskDueDate(task.dueAt, task.dueDateKind, timeZone)}
            </span>
          </div>
        ) : (
          <div
            className="task-no-due-chip"
            title="Chưa đặt hạn chót - Nhấn để cập nhật"
            onClick={() => onSelect(task.id)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>Chưa có hạn</span>
          </div>
        )}

        {/* Hover Quick Action Buttons */}
        <div className="task-row-actions">
          <button
            type="button"
            className="btn-quick-action view"
            onClick={() => onSelect(task.id)}
            title="Xem & chỉnh sửa chi tiết"
          >
            Chi tiết &rarr;
          </button>
          <button
            type="button"
            className="btn-quick-action delete"
            onClick={handleDelete}
            title="Xóa công việc"
            aria-label={`Xóa công việc ${task.title}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
