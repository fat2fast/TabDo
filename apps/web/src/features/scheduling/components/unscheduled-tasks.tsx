import React from 'react'
import { useAuth } from '../../auth/auth-provider'
import { useTaskList } from '../../tasks/hooks/use-tasks'
import type { Task } from '../../tasks/types'

export interface UnscheduledTasksProps {
  onScheduleTask: (task: Task) => void
  onClose?: () => void
}

export function UnscheduledTasks({ onScheduleTask, onClose }: UnscheduledTasksProps) {
  const { profile } = useAuth()
  const timeZone = profile?.timezone || 'Asia/Ho_Chi_Minh'

  const now = React.useMemo(() => new Date(), [])
  const { data: tasks = [], isLoading } = useTaskList({
    view: 'inbox',
    timeZone,
    limit: 20,
    now,
  })

  const [search, setSearch] = React.useState('')

  // Filter active tasks
  const activeTasks = React.useMemo(() => {
    const list = tasks.filter((t) => t.status !== 'done')
    if (!search.trim()) return list
    const term = search.toLowerCase()
    return list.filter((t) => t.title.toLowerCase().includes(term))
  }, [tasks, search])

  return (
    <div className="tabdo-unscheduled-tasks" data-testid="unscheduled-tasks-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-header-left">
          <span className="sidebar-icon">📋</span>
          <h3 className="sidebar-title">Cần lên lịch</h3>
        </div>
        <div className="sidebar-header-right">
          <span className="count-badge" title={`${activeTasks.length} việc cần làm`}>
            {activeTasks.length}
          </span>
          {onClose && (
            <button
              type="button"
              className="sidebar-close-btn"
              onClick={onClose}
              title="Thu gọn"
              aria-label="Thu gọn danh sách việc cần lên lịch"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Task search input */}
      <div className="sidebar-search-box">
        <input
          type="text"
          className="sidebar-search-input"
          placeholder="Tìm công việc..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            type="button"
            className="sidebar-search-clear"
            onClick={() => setSearch('')}
            aria-label="Xóa tìm kiếm"
          >
            ✕
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="sidebar-loading">
          <div className="loading-spinner-sm" />
          <span>Đang tải công việc...</span>
        </div>
      ) : activeTasks.length === 0 ? (
        <div className="sidebar-empty">
          {search ? (
            <span>Không tìm thấy công việc phù hợp.</span>
          ) : (
            <div className="sidebar-all-scheduled">
              <span className="empty-sparkle">✨</span>
              <span>Tất cả công việc đã được lên lịch!</span>
            </div>
          )}
        </div>
      ) : (
        <div className="sidebar-task-list">
          {activeTasks.map((task) => (
            <div
              key={task.id}
              className="unscheduled-task-item"
              data-testid={`unscheduled-task-${task.id}`}
            >
              <div className="task-item-info">
                <span className="task-item-title" title={task.title}>
                  {task.title}
                </span>
                <div className="task-item-meta">
                  {task.priority !== 'medium' && (
                    <span className={`priority-tag priority-${task.priority}`}>
                      {task.priority === 'high' ? 'Ưu tiên cao' : 'Ưu tiên thấp'}
                    </span>
                  )}
                  {task.dueAt && (
                    <span className="task-due-hint">
                      Hạn: {new Date(task.dueAt).toLocaleDateString('vi-VN')}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-xs schedule-btn-hover"
                onClick={() => onScheduleTask(task)}
                title="Lên lịch cho công việc này"
                data-testid={`schedule-unscheduled-${task.id}`}
              >
                + Lịch
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
