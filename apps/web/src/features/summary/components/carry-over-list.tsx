import React from 'react'
import type { Task } from '@tabdo/types'
import { formatTaskDueDate } from '@tabdo/utils'
import { useI18n } from '../../i18n/i18n-provider'

export interface CarryOverListProps {
  tasks: Task[]
  timeZone: string
  onSelectTask?: (taskId: string) => void
}

export function CarryOverList({ tasks, timeZone, onSelectTask }: CarryOverListProps) {
  const { t } = useI18n()

  return (
    <section className="card summary-section-card" data-testid="summary-carryover-section">
      <div className="summary-section-header">
        <h3 className="summary-section-title">
          {t('summary.carryOverSection')} ({tasks.length})
        </h3>
      </div>

      {tasks.length === 0 ? (
        <div className="summary-empty-state">
          <p className="summary-empty-text">{t('summary.carryOverEmpty')}</p>
        </div>
      ) : (
        <ul className="summary-task-list" aria-label={t('summary.carryOverSection')}>
          {tasks.map((task) => {
            const formattedDue = formatTaskDueDate(task.dueAt, task.dueDateKind, timeZone)
            return (
              <li
                key={task.id}
                className={`summary-task-item is-pending ${onSelectTask ? 'is-clickable' : ''}`}
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
                <span className="summary-task-pending-dot" aria-hidden="true" />
                <div className="summary-task-content">
                  <span className="summary-task-title">{task.title}</span>
                  {formattedDue && (
                    <span className="summary-task-meta">{formattedDue}</span>
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
