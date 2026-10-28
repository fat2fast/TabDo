import React, { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useSafeNavigate } from '../../pwa/use-safe-navigate'
import type { Task } from '../../tasks/types'
import { useI18n } from '../../i18n/i18n-provider'
import { DashboardEmptyState } from './dashboard-empty-state'
import { formatTaskDueDate } from '@tabdo/utils'
import { fetchPriorityTasksPaged } from '../api/dashboard'
import { useWidgetScrollPagination } from '../hooks/use-widget-scroll-pagination'

export interface PriorityTasksProps {
  tasks: Task[]
  total?: number
  timeZone: string
  onCreateTask?: () => void
  onSelectTask?: (taskId: string) => void
}

export function PriorityTasks({ tasks = [], total, timeZone, onCreateTask, onSelectTask }: PriorityTasksProps) {
  const { t } = useI18n()
  const navigate = useSafeNavigate()

  const fetchPage = useCallback(
    (page: number) => fetchPriorityTasksPaged({ page, pageSize: 5, timeZone }),
    [timeZone]
  )

  const {
    items,
    isLoadingMore,
    handleScroll,
    scrollContainerRef,
    sentinelRef,
  } = useWidgetScrollPagination<Task>({
    initialItems: tasks,
    total,
    fetchPage,
    pageSize: 5,
  })

  const displayTotal = total !== undefined ? total : items.length

  return (
    <section className="card dashboard-section dashboard-area-priority" aria-label={t('dashboard.priorityTasks')}>
      <div className="section-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 className="section-title">{t('dashboard.priorityTasks')}</h3>
            <span className="count-badge" aria-label={`${displayTotal} tasks`}>
              {displayTotal}
            </span>
          </div>
          <p className="section-subtitle">{t('dashboard.priorityTasksSubtitle')}</p>
        </div>
        <Link to="/tasks/today" className="section-link dashboard-action-btn">
          <span>{t('dashboard.viewAllTasks')}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>

      {items.length === 0 ? (
        <DashboardEmptyState type="tasks" onCreateTask={onCreateTask} />
      ) : (
        <div
          className="dashboard-scrollable-container"
          ref={scrollContainerRef}
          onScroll={handleScroll}
        >
          <ul className="dashboard-task-list" role="list">
            {items.map((task) => (
              <li
                key={task.id}
                className="dashboard-task-item"
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
                <div className="task-primary-info">
                  <span className="dashboard-item-title">{task.title}</span>
                  {task.recurrenceRule && (
                    <span className="recurrence-chip" title="Công việc lặp lại" aria-label="Lặp lại">
                      ↻
                    </span>
                  )}
                </div>
                <div className="task-secondary-info">
                  <span className={`priority-tag priority-${task.priority}`}>
                    {task.priority === 'high' ? 'Cao' : task.priority === 'medium' ? 'Trung bình' : 'Thấp'}
                  </span>
                  {task.dueAt && (
                    <span className="task-due-date">
                      {formatTaskDueDate(task.dueAt, task.dueDateKind, timeZone)}
                    </span>
                  )}
                </div>
              </li>
            ))}
            {isLoadingMore && (
              <li className="dashboard-scroll-loader">
                <span className="dashboard-scroll-spinner" />
                <span>{t('common.loading', 'Đang tải thêm...')}</span>
              </li>
            )}
          </ul>
          <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />
        </div>
      )}
    </section>
  )
}
