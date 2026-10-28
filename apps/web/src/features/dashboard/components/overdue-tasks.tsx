import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSafeNavigate } from '../../pwa/use-safe-navigate'
import type { Task } from '../../tasks/types'
import { useI18n } from '../../i18n/i18n-provider'
import { formatTaskDueDate, formatTaskOverdueDuration } from '@tabdo/utils'
import { formatCompactOverdue } from '../../tasks/utils/compact-overdue'

export interface OverdueTasksProps {
  tasks: Task[]
  timeZone: string
  onSelectTask?: (taskId: string) => void
}

const STORAGE_KEY = 'tabdo:dashboard:overdue-collapsed'

export function OverdueTasks({ tasks, timeZone, onSelectTask }: OverdueTasksProps) {
  const { t, locale } = useI18n()
  const navigate = useSafeNavigate()
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }

  if (!tasks || tasks.length === 0) {
    return null
  }

  return (
    <section
      className={`card dashboard-overdue-alert ${isCollapsed ? 'is-collapsed' : ''}`}
      aria-label={t('dashboard.overdueAlertTitle')}
    >
      <div className="alert-header">
        <div className="alert-badge">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="alert-title">{t('dashboard.overdueAlertTitle')} ({tasks.length})</span>
        </div>

        <div className="alert-header-actions">
          <Link to="/tasks/overdue" className="alert-link dashboard-action-btn">
            <span>{t('dashboard.viewAllTasks')}</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>

          <button
            type="button"
            className="dashboard-collapse-btn overdue-collapse-btn"
            onClick={toggleCollapsed}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? 'Mở rộng danh sách quá hạn' : 'Thu gọn danh sách quá hạn'}
            title={isCollapsed ? 'Mở rộng' : 'Thu gọn'}
            data-testid="collapse-overdue-btn"
          >
            <svg
              className={`collapse-chevron-icon ${isCollapsed ? 'is-collapsed' : ''}`}
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <ul className="overdue-list" role="list">
          {tasks.slice(0, 3).map((task) => (
            <li
              key={task.id}
              className="overdue-item"
              role="button"
              tabIndex={0}
              onClick={() => {
                if (onSelectTask) {
                  onSelectTask(task.id)
                } else {
                  navigate(`/tasks/today?taskId=${task.id}`)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  if (onSelectTask) {
                    onSelectTask(task.id)
                  } else {
                    navigate(`/tasks/today?taskId=${task.id}`)
                  }
                }
              }}
            >
              <span className="overdue-task-title">{task.title}</span>
              <div className="overdue-meta">
                <span className={`priority-tag priority-${task.priority}`}>
                  {task.priority === 'high' ? 'Cao' : task.priority === 'medium' ? 'Trung bình' : 'Thấp'}
                </span>
                <span className="overdue-date">
                  {task.dueAt && <>
                    <span className="task-overdue-desktop">{formatTaskOverdueDuration(task.dueAt, new Date(), locale) || formatTaskDueDate(task.dueAt, task.dueDateKind, timeZone)}</span>
                    <span className="task-overdue-mobile">{formatCompactOverdue(task.dueAt, new Date(), locale)}</span>
                  </>}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
