import React, { useState } from 'react'
import { useTaskDetail } from '../hooks/use-tasks'
import { TaskDetailView } from './task-detail-view'
import { TaskForm } from './task-form'
import type { Task } from '../types'

export interface TaskDrawerProps {
  taskId: string | null
  initialMode?: 'view' | 'edit'
  onClose: (savedTask?: Task) => void
  onSelectTask?: (taskId: string) => void
}

export function TaskDrawer({
  taskId,
  initialMode = 'view',
  onClose,
  onSelectTask,
}: TaskDrawerProps) {
  const { data: task, isLoading, error } = useTaskDetail(taskId)
  const [isEditing, setIsEditing] = useState(initialMode === 'edit')

  // Reset editing mode when taskId changes
  React.useEffect(() => {
    setIsEditing(initialMode === 'edit')
  }, [taskId, initialMode])

  // Support hotkey Escape to close the drawer
  React.useEffect(() => {
    if (!taskId) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (isEditing) {
          setIsEditing(false)
        } else {
          onClose()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [taskId, isEditing, onClose])

  if (!taskId) return null

  return (
    <div
      className="task-drawer-backdrop"
      data-testid="task-drawer-backdrop"
    >
      <div
        className="task-drawer-panel task-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="drawer-title"
        data-testid="task-drawer"
      >
        <div className="drawer-header">
          <div className="drawer-title-group">
            <h3 id="drawer-title" className="drawer-title">
              {isEditing ? 'Chỉnh sửa công việc' : 'Chi tiết công việc'}
            </h3>
            {task?.parentId && (
              <span className="drawer-subtask-pill">
                ↳ Việc con
              </span>
            )}
            {isEditing && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsEditing(false)}
                style={{ marginLeft: '8px', fontSize: '0.75rem', height: '28px', padding: '0 10px' }}
                title="Quay lại màn hình xem chi tiết"
              >
                &larr; Xem chi tiết
              </button>
            )}
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={() => onClose()}
            aria-label="Đóng bảng chi tiết"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="drawer-body">
          {isLoading ? (
            <div className="drawer-loading">
              <div className="loading-spinner" />
              <span>Đang tải chi tiết công việc...</span>
            </div>
          ) : error || !task ? (
            <div className="alert-error" role="alert">
              Không tìm thấy công việc hoặc công việc đã bị xóa.
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: '12px' }}
                onClick={() => onClose()}
              >
                Đóng
              </button>
            </div>
          ) : isEditing ? (
            <TaskForm
              task={task}
              onSaveSuccess={() => {
                setIsEditing(false)
              }}
              onCancel={() => setIsEditing(false)}
              onDeleted={() => onClose()}
              onNavigateParent={onSelectTask}
            />
          ) : (
            <TaskDetailView
              task={task}
              onEdit={() => setIsEditing(true)}
              onClose={() => onClose()}
              onDeleted={() => onClose()}
              onNavigateParent={onSelectTask}
            />
          )}
        </div>
      </div>
    </div>
  )
}
