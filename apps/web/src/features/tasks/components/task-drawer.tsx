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
  const panelRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLElement | null>(null)

  // Capture trigger focus and lock body scroll on open
  React.useEffect(() => {
    if (taskId) {
      triggerRef.current = document.activeElement as HTMLElement | null
      const prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'

      requestAnimationFrame(() => {
        const focusable = panelRef.current?.querySelector<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        focusable?.focus()
      })

      return () => {
        document.body.style.overflow = prevOverflow
        triggerRef.current?.focus?.()
      }
    }
  }, [Boolean(taskId)])

  // Reset editing mode when taskId changes
  React.useEffect(() => {
    setIsEditing(initialMode === 'edit')
  }, [taskId, initialMode])

  // Support hotkey Escape and Tab focus trap
  React.useEffect(() => {
    if (!taskId) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // If a nested child overlay (confirm dialog, dropdown menu, date picker) is open, let it close first
        const hasTopOverlay = document.querySelector(
          '.confirm-dialog-backdrop, .custom-dropdown-menu.open, .date-picker-popover-content'
        )
        if (hasTopOverlay) {
          return
        }
        if (isEditing) {
          setIsEditing(false)
        } else {
          onClose()
        }
        return
      }

      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return

        const first = focusables[0]
        const last = focusables[focusables.length - 1]

        if (!panelRef.current.contains(document.activeElement)) {
          e.preventDefault()
          first.focus()
          return
        }

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
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
        ref={panelRef}
        className="task-drawer-panel task-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
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
