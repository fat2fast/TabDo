import React from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/i18n-provider'

interface DashboardEmptyStateProps {
  type: 'tasks' | 'schedule' | 'upcoming'
  onCreateTask?: () => void
}

export function DashboardEmptyState({ type, onCreateTask }: DashboardEmptyStateProps) {
  const { t } = useI18n()

  if (type === 'tasks') {
    return (
      <div className="dashboard-empty-box">
        <div className="empty-icon-wrap" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        </div>
        <p className="empty-title">{t('dashboard.emptyTodayTasks')}</p>
        <p className="empty-subtitle">{t('dashboard.emptyTodayTasksSub')}</p>
        <div className="empty-actions">
          {onCreateTask ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={onCreateTask}>
              + {t('dashboard.createTask')}
            </button>
          ) : (
            <Link to="/tasks/today" className="btn btn-primary btn-sm">
              + {t('dashboard.createTask')}
            </Link>
          )}
        </div>
      </div>
    )
  }

  if (type === 'schedule') {
    return (
      <div className="dashboard-empty-box">
        <div className="empty-icon-wrap" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <p className="empty-title">{t('dashboard.emptyTodaySchedule')}</p>
        <p className="empty-subtitle">{t('dashboard.emptyTodayScheduleSub')}</p>
        <div className="empty-actions">
          <Link to="/calendar" className="btn btn-secondary btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>{t('dashboard.goToCalendar')}</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-empty-box">
      <p className="empty-subtitle">{t('dashboard.emptyUpcoming')}</p>
    </div>
  )
}
