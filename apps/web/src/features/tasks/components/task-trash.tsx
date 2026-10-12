import React, { useState } from 'react'
import { useCategories } from '../hooks/use-categories'
import { useTaskMutations } from '../hooks/use-task-mutations'
import { useTrashTasks } from '../hooks/use-tasks'
import { useI18n } from '../../i18n/i18n-provider'
import { useConfirm } from '../../../components/ui'
import { TaskViewEmptyState } from './task-view-empty-state'
import type { Task } from '../types'

export interface TaskTrashProps {
  onSelectTask?: (id: string) => void
}

export function TaskTrash({ onSelectTask }: TaskTrashProps) {
  const { t } = useI18n()
  const confirm = useConfirm()
  const [search, setSearch] = useState('')
  const [actionFeedback, setActionFeedback] = useState<string | null>(null)

  const { data: categories = [] } = useCategories()
  const { data: trashedTasks = [], isLoading } = useTrashTasks(search)
  const { restoreTaskMutation, purgeTaskMutation } = useTaskMutations()

  const handleRestore = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await restoreTaskMutation.mutateAsync({
        id: task.id,
        parentId: task.parentId,
      })
      setActionFeedback(`${t('tasks.restoredFromTrash')}: "${task.title}"`)
      setTimeout(() => setActionFeedback(null), 4000)
    } catch (err: any) {
      confirm({
        title: 'Lỗi khôi phục',
        message: err?.message || 'Không thể khôi phục công việc.',
        confirmText: 'Đã hiểu',
        cancelText: null,
        variant: 'warning',
      })
    }
  }

  const handlePurge = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation()
    const confirmed = await confirm({
      title: t('tasks.confirmPurgeTitle') || 'Xóa vĩnh viễn công việc?',
      message: (
        <span>
          {t('tasks.confirmPurgeMessage') ||
            'Hành động này không thể hoàn tác. Mọi dữ liệu liên quan sẽ bị xóa vĩnh viễn.'}
          <br />
          <strong>"{task.title}"</strong>
        </span>
      ),
      confirmText: t('tasks.purgePermanently') || 'Xóa vĩnh viễn',
      cancelText: 'Hủy',
      variant: 'danger',
    })

    if (confirmed) {
      try {
        await purgeTaskMutation.mutateAsync({
          id: task.id,
          parentId: task.parentId,
        })
        setActionFeedback(`${t('tasks.purgedPermanently')}: "${task.title}"`)
        setTimeout(() => setActionFeedback(null), 4000)
      } catch (err: any) {
        confirm({
          title: 'Lỗi xóa',
          message: err?.message || 'Không thể xóa vĩnh viễn công việc.',
          confirmText: 'Đã hiểu',
          cancelText: null,
          variant: 'warning',
        })
      }
    }
  }

  const getDaysRemaining = (deletedAt?: string | null) => {
    if (!deletedAt) return 30
    const deletedTime = new Date(deletedAt).getTime()
    const diffDays = Math.floor((Date.now() - deletedTime) / (1000 * 60 * 60 * 24))
    return Math.max(0, 30 - diffDays)
  }

  return (
    <div className="task-trash-container" data-testid="task-trash-container">
      {/* 30-Day Retention Notice Banner */}
      <div className="trash-retention-banner" role="status">
        <div className="banner-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div className="banner-text">
          <strong>{t('tasks.trashRetentionNotice')}</strong>
          <span className="banner-subtext">
            Các công việc có thể khôi phục bất cứ lúc nào trước thời hạn 30 ngày.
          </span>
        </div>
      </div>

      {/* Immediate Action Feedback Toast */}
      {actionFeedback && (
        <div className="trash-feedback-banner" role="alert">
          <span>{actionFeedback}</span>
          <button
            type="button"
            className="feedback-dismiss-btn"
            onClick={() => setActionFeedback(null)}
            aria-label="Đóng"
          >
            &times;
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="trash-controls card">
        <div className="trash-search-wrapper">
          <svg
            className="trash-search-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="trash-search-input"
            placeholder="Tìm kiếm công việc trong Thùng rác..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Tìm kiếm trong Thùng rác"
          />
          {search && (
            <button
              type="button"
              className="trash-search-clear"
              onClick={() => setSearch('')}
              aria-label="Xóa tìm kiếm"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Task List Content */}
      <div className="trash-content-area">
        {isLoading ? (
          <div className="task-list-loading" data-testid="trash-loading">
            <div className="loading-spinner" />
            <span>Đang tải Thùng rác...</span>
          </div>
        ) : trashedTasks.length === 0 ? (
          <TaskViewEmptyState
            view="trash"
            hasFilters={Boolean(search.trim())}
            onClearFilters={() => setSearch('')}
          />
        ) : (
          <div className="trash-task-list" role="list" aria-label="Danh sách công việc đã xóa">
            {trashedTasks.map((task) => {
              const category = categories.find((c) => c.id === task.categoryId)
              const daysRemaining = getDaysRemaining(task.deletedAt)
              const isPending =
                restoreTaskMutation.isPending || purgeTaskMutation.isPending

              return (
                <div
                  key={task.id}
                  className="trash-task-row"
                  onClick={() => onSelectTask?.(task.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectTask?.(task.id)
                    }
                  }}
                  data-testid={`trash-task-${task.id}`}
                >
                  <div className="trash-task-left">
                    <span className="trash-task-icon" aria-hidden="true">
                      🗑️
                    </span>
                    <div className="trash-task-info">
                      <div className="trash-task-title-line">
                        <span className="trash-task-title">{task.title}</span>
                      </div>
                      <div className="trash-task-meta">
                        {category && (
                          <span
                            className="task-badge category-badge"
                            style={{
                              backgroundColor: `${category.color || '#6366f1'}15`,
                              color: category.color || '#6366f1',
                              borderColor: `${category.color || '#6366f1'}30`,
                            }}
                          >
                            🏷️ {category.name}
                          </span>
                        )}

                        <span
                          className={`task-badge priority-badge priority-${task.priority}`}
                        >
                          {task.priority === 'high'
                            ? 'Ưu tiên cao'
                            : task.priority === 'medium'
                            ? 'Trung bình'
                            : 'Ưu tiên thấp'}
                        </span>

                        <span
                          className={`task-badge days-left-badge ${
                            daysRemaining <= 3 ? 'days-left-warning' : ''
                          }`}
                          title={`Tự động xóa vĩnh viễn sau ${daysRemaining} ngày`}
                        >
                          ⏳ Còn {daysRemaining} ngày
                        </span>

                        {task.purgeStatus === 'pending' && (
                          <span className="task-badge purge-pending-badge">
                            ⚠️ {t('tasks.purgePending')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    className="trash-task-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => handleRestore(task, e)}
                      disabled={isPending}
                      aria-label={`Khôi phục công việc ${task.title}`}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                      </svg>
                      <span>{t('tasks.restore')}</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-danger-ghost btn-sm"
                      onClick={(e) => handlePurge(task, e)}
                      disabled={isPending}
                      aria-label={`Xóa vĩnh viễn công việc ${task.title}`}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      <span>{t('tasks.purgePermanently')}</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
