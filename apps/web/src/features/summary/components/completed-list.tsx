import React from 'react'
import type { Task } from '@tabdo/types'
import { formatTaskCompletedAt } from '@tabdo/utils'
import { useI18n } from '../../i18n/i18n-provider'

export interface CompletedListProps {
  tasks: Task[]
  timeZone: string
  onSelectTask?: (taskId: string) => void
}

export function CompletedList({ tasks, timeZone, onSelectTask }: CompletedListProps) {
  const { t } = useI18n()

  return (
    <section className="card summary-section-card" data-testid="summary-completed-section">
      <div className="summary-section-header">
        <h3 className="summary-section-title">
          {t('summary.completedSection')} ({tasks.length})
        </h3>
      </div>

      {tasks.length === 0 ? (
        <div className="summary-empty-state">
          <p className="summary-empty-text">{t('summary.completedEmpty')}</p>
        </div>
      ) : (
        <ul className="summary-task-list" aria-label={t('summary.completedSection')}>
          {tasks.map((task) => {
            const formattedCompleted = formatTaskCompletedAt(task.completedAt, timeZone)
            return (
              <li
                key={task.id}
                className={`summary-task-item is-completed ${onSelectTask ? 'is-clickable' : ''}`}
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
                <span className="summary-task-check-icon" aria-hidden="true">✓</span>
                <div className="summary-task-content">
                  <span className="summary-task-title">{task.title}</span>
                  {formattedCompleted && (
                    <span className="summary-task-meta">{formattedCompleted}</span>
                  )}
                </div>
                <span className={`summary-priority-badge priority-${task.priority}`}>
                  {task.priority}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
