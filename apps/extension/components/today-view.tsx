import React from 'react'
import { formatTaskDueDate } from '@tabdo/utils'
import type { ExtensionAuthUser, ExtensionSyncMetadata, ExtensionTodayTask } from '../lib/types.js'

interface TodayViewProps {
  user: ExtensionAuthUser
  tasks: ExtensionTodayTask[]
  syncMetadata: ExtensionSyncMetadata
  onCompleteTask: (taskId: string, previousUpdatedAt?: string) => Promise<void>
  onOpenTask: (taskId: string) => Promise<void>
  onGoToQuickAdd: () => void
  onGoToSettings: () => void
  onSync?: () => Promise<void>
  isSyncing?: boolean
  isCompletingTaskId?: string | null
}

export function TodayView({
  user,
  tasks,
  syncMetadata,
  onCompleteTask,
  onOpenTask,
  onGoToQuickAdd,
  onGoToSettings,
  onSync,
  isSyncing = false,
  isCompletingTaskId = null,
}: TodayViewProps) {
  const activeTasks = tasks.filter((t) => t.status !== 'done')
  const completedTasks = tasks.filter((t) => t.status === 'done')

  return (
    <div className="tabdo-view today-view">
      {/* Header */}
      <div className="tabdo-header">
        <div className="tabdo-header-row">
          <div>
            <h2 className="tabdo-view-title">Hôm nay</h2>
            <p className="tabdo-view-subtitle">
              {activeTasks.length > 0
                ? `${activeTasks.length} việc cần hoàn thành`
                : 'Đã hoàn thành mọi việc hôm nay'}
            </p>
          </div>
          <div className="tabdo-header-actions">
            {onSync && (
              <button
                type="button"
                onClick={onSync}
                disabled={isSyncing}
                className={`tabdo-btn tabdo-btn-icon ${isSyncing ? 'syncing' : ''}`}
                title="Đồng bộ với máy chủ"
                aria-label="Đồng bộ"
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
                  className={isSyncing ? 'tabdo-spin' : ''}
                >
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 21h5v-5" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={onGoToQuickAdd}
              className="tabdo-btn tabdo-btn-primary tabdo-btn-sm"
              title="Thêm công việc nhanh"
              aria-label="Thêm việc"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Thêm</span>
            </button>
            <button
              type="button"
              onClick={onGoToSettings}
              className="tabdo-btn tabdo-btn-icon"
              title="Cài đặt kết nối"
              aria-label="Cài đặt"
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
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>

        {syncMetadata.isStale && (
          <div className="tabdo-stale-banner" role="status">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>Đang xem dữ liệu ngoại tuyến (chưa đồng bộ)</span>
          </div>
        )}
      </div>

      {/* Task List Workspace */}
      <div className="tabdo-task-list">
        {activeTasks.length === 0 && completedTasks.length === 0 ? (
          <div className="tabdo-empty-state">
            <div className="tabdo-empty-icon">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="tabdo-empty-text">Không có công việc nào hôm nay.</p>
            <button
              type="button"
              onClick={onGoToQuickAdd}
              className="tabdo-btn tabdo-btn-primary tabdo-btn-sm"
            >
              + Tạo công việc mới
            </button>
          </div>
        ) : (
          <ul className="tabdo-list" role="list">
            {activeTasks.map((task) => {
              const dueDisplay = task.dueAt
                ? formatTaskDueDate(task.dueAt, task.dueDateKind, user.timezone)
                : null
              const isCompleting = isCompletingTaskId === task.id
              const isTimed = task.dueDateKind === 'date_time' && task.dueAt

              return (
                <li key={task.id} className="tabdo-task-item" data-testid={`task-item-${task.id}`}>
                  <button
                    type="button"
                    onClick={() => onCompleteTask(task.id, task.updatedAt)}
                    disabled={isCompleting}
                    className="tabdo-checkbox-btn"
                    title="Đánh dấu hoàn thành"
                    aria-label={`Hoàn thành việc: ${task.title}`}
                  >
                    <span className="tabdo-checkbox-circle">
                      {isCompleting ? (
                        <span className="tabdo-spin tabdo-loading-dot">◌</span>
                      ) : (
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="tabdo-check-icon"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                  </button>

                  <div
                    className="tabdo-task-info"
                    onClick={() => onOpenTask(task.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onOpenTask(task.id)
                      }
                    }}
                    title="Mở trong TabDo Web"
                  >
                    <span className="tabdo-task-title">{task.title}</span>
                    <div className="tabdo-task-meta-row">
                      {isTimed && dueDisplay ? (
                        <span className="tabdo-badge tabdo-badge-time">
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          <span>{dueDisplay}</span>
                        </span>
                      ) : (
                        <span className="tabdo-badge tabdo-badge-today">Hôm nay</span>
                      )}

                      {task.priority === 'high' && (
                        <span className="tabdo-badge tabdo-badge-priority-high">
                          <span className="tabdo-priority-dot high"></span>
                          <span>Cao</span>
                        </span>
                      )}
                      {task.priority === 'medium' && (
                        <span className="tabdo-badge tabdo-badge-priority-medium">
                          <span className="tabdo-priority-dot medium"></span>
                          <span>Vừa</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenTask(task.id)}
                    className="tabdo-btn-link-icon"
                    title="Mở trong ứng dụng Web"
                    aria-label={`Mở việc ${task.title} trong web`}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </button>
                </li>
              )
            })}

            {completedTasks.length > 0 && (
              <li className="tabdo-completed-section">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="tabdo-completed-count">
                  Đã hoàn thành ({completedTasks.length})
                </span>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
