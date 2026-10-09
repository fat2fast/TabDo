import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Task } from '../../tasks/types'
import { useI18n } from '../../i18n/i18n-provider'
import { DashboardEmptyState } from './dashboard-empty-state'
import { formatTaskDueDate } from '@tabdo/utils'

interface PriorityTasksProps {
  tasks: Task[]
  timeZone: string
  onCreateTask?: () => void
}

export function PriorityTasks({ tasks, timeZone, onCreateTask }: PriorityTasksProps) {
  const { t } = useI18n()
  const navigate = useNavigate()

  return (
    <section className="card dashboard-section" aria-label={t('dashboard.priorityTasks')}>
      <div className="section-header">
        <div>
          <h3 className="section-title">{t('dashboard.priorityTasks')}</h3>
          <p className="section-subtitle">{t('dashboard.priorityTasksSubtitle')}</p>
        </div>
        <Link to="/tasks/today" className="section-link dashboard-action-btn">
          <span>{t('dashboard.viewAllTasks')}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>

      {tasks.length === 0 ? (
        <DashboardEmptyState type="tasks" onCreateTask={onCreateTask} />
      ) : (
        <ul className="dashboard-task-list" role="list">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="dashboard-task-item"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/tasks/today?taskId=${task.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  navigate(`/tasks/today?taskId=${task.id}`)
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
        </ul>
      )}
    </section>
  )
}
