import React from 'react'
import type { Task } from '@tabdo/types'
import { formatTaskDueDate, getOverdueDurationString } from '@tabdo/utils'
import { useI18n } from '../../i18n/i18n-provider'

export interface OverdueSummaryProps {
  tasks: Task[]
  timeZone: string
  referenceNow?: Date
  onSelectTask?: (taskId: string) => void
}

export function OverdueSummary({
  tasks,
  timeZone,
  referenceNow = new Date(),
  onSelectTask,
}: OverdueSummaryProps) {
  const { t } = useI18n()

  if (tasks.length === 0) {
    return (
      <section className="card summary-section-card" data-testid="summary-overdue-section">
        <div className="summary-section-header">
          <h3 className="summary-section-title">
            {t('summary.overdueSection')} (0)
          </h3>
        </div>
        <div className="summary-empty-state">
          <p className="summary-empty-text">{t('summary.overdueEmpty')}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="card summary-section-card is-danger-alert" data-testid="summary-overdue-section">
      <div className="summary-section-header">
        <h3 className="summary-section-title text-danger">
          ⚠️ {t('summary.overdueSection')} ({tasks.length})
        </h3>
      </div>

      <ul className="summary-task-list" aria-label={t('summary.overdueSection')}>
        {tasks.map((task) => {
          const duration = task.dueAt
            ? getOverdueDurationString(task.dueAt, referenceNow)
            : ''
          const formattedDue = formatTaskDueDate(task.dueAt, task.dueDateKind, timeZone)

          return (
            <li
              key={task.id}
              className={`summary-task-item is-overdue ${onSelectTask ? 'is-clickable' : ''}`}
              onClick={() => onSelectTask?.(task.id)}
              role={onSelectTask ? 'button' : undefined}
              tabIndex={onSelectTask ? 0 : undefined}
              onKeyDown={
                onSelectTask
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelectTask(task.id)
                      }
                    }
                  : undefined
              }
              data-testid={`summary-task-item-${task.id}`}
            >
              <span className="summary-task-overdue-icon" aria-hidden="true">!</span>
              <div className="summary-task-content">
                <span className="summary-task-title">{task.title}</span>
                <span className="summary-task-meta text-danger">
                  {duration || formattedDue}
                </span>
              </div>
              <span className={`summary-priority-badge priority-${task.priority}`}>
                {task.priority}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
