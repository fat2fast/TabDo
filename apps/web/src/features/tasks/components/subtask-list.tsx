import React, { useState } from 'react'
import { useSubtasks } from '../hooks/use-tasks'
import { useTaskMutations } from '../hooks/use-task-mutations'
import type { Task } from '../types'

export interface SubtaskListProps {
  parentTask: Task
  onSelectSubtask?: (subtaskId: string) => void
}

export function SubtaskList({ parentTask, onSelectSubtask }: SubtaskListProps) {
  const { data: subtasks = [], isLoading } = useSubtasks(parentTask.id)
  const { createTaskMutation, completeTaskMutation, reopenTaskMutation, deleteTaskMutation } =
    useTaskMutations()

  const [newTitle, setNewTitle] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const completedCount = subtasks.filter((st) => st.status === 'done').length
  const totalCount = subtasks.length
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const handleAddSubtask = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setErrorMsg(null)
    const trimmed = newTitle.trim()
    if (!trimmed) {
      setErrorMsg('Tiêu đề công việc con không được để trống.')
      return
    }

    try {
      await createTaskMutation.mutateAsync({
        title: trimmed,
        parentId: parentTask.id,
        categoryId: parentTask.categoryId, // optional inherit or null
        priority: 'medium',
      })
      setNewTitle('')
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể tạo công việc con.')
    }
  }

  const handleToggle = (subtask: Task) => {
    if (subtask.status === 'done') {
      reopenTaskMutation.mutate(subtask)
    } else {
      completeTaskMutation.mutate(subtask)
    }
  }

  const handleDelete = (subtaskId: string) => {
    deleteTaskMutation.mutate({ id: subtaskId, parentId: parentTask.id })
  }

  return (
    <div className="subtask-section" data-testid="subtask-list">
      <div className="subtask-header-row">
        <div className="subtask-title-group">
          <span className="subtask-icon-title">↳</span>
          <h4 className="subtask-header">Công việc con</h4>
          {totalCount > 0 && (
            <span className="subtask-progress-badge">
              {completedCount}/{totalCount} ({percent}%)
            </span>
          )}
        </div>
      </div>

      {totalCount > 0 && (
        <div className="subtask-progress-track">
          <div
            className="subtask-progress-fill"
            style={{ width: `${percent}%` }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      )}

      {errorMsg && (
        <div className="alert-error" role="alert">
          {errorMsg}
        </div>
      )}

      {isLoading ? (
        <div className="subtask-loading">Đang tải...</div>
      ) : subtasks.length === 0 ? (
        <p className="subtask-empty">Chưa có công việc con nào. Chia nhỏ công việc để hoàn thành dễ dàng hơn.</p>
      ) : (
        <ul className="subtask-items">
          {subtasks.map((st) => {
            const isDone = st.status === 'done'
            return (
              <li key={st.id} className={`subtask-item ${isDone ? 'done' : ''}`}>
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={() => handleToggle(st)}
                  className="subtask-checkbox"
                  aria-label={`Hoàn thành: ${st.title}`}
                />
                <span
                  className={`subtask-title ${isDone ? 'line-through' : ''}`}
                  onClick={() => onSelectSubtask?.(st.id)}
                  role={onSelectSubtask ? 'button' : undefined}
                  tabIndex={onSelectSubtask ? 0 : undefined}
                >
                  {st.title}
                </span>
                <button
                  type="button"
                  className="subtask-delete-btn"
                  onClick={() => handleDelete(st.id)}
                  title="Xóa công việc con"
                  aria-label={`Xóa công việc con: ${st.title}`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="subtask-add-form">
        <div className="subtask-input-wrapper">
          <input
            type="text"
            placeholder="Thêm công việc con..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation()
                handleAddSubtask()
              }
            }}
            className="subtask-add-input"
            disabled={createTaskMutation.isPending}
          />
          <button
            type="button"
            onClick={handleAddSubtask}
            className="subtask-add-btn"
            disabled={createTaskMutation.isPending || !newTitle.trim()}
          >
            Thêm
          </button>
        </div>
      </div>
    </div>
  )
}
