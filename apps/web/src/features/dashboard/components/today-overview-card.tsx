import React from 'react'
import type { DashboardMetrics } from '../types'
import { useI18n } from '../../i18n/i18n-provider'

interface TodayOverviewCardProps {
  metrics: DashboardMetrics
  isLoading?: boolean
}

export function TodayOverviewCard({ metrics, isLoading }: TodayOverviewCardProps) {
  const { t } = useI18n()

  if (isLoading) {
    return (
      <div className="card dashboard-overview-card skeleton-loading" aria-busy="true">
        <div className="skeleton-line title" />
        <div className="skeleton-grid" />
      </div>
    )
  }

  const {
    relevantCount,
    completedCount,
    remainingCount,
    overdueCount,
    completionPercentage,
  } = metrics

  return (
    <section className="card dashboard-overview-card" aria-label={t('dashboard.todayOverview')}>
      <div className="overview-header">
        <div>
          <h2 className="overview-title">{t('dashboard.todayOverview')}</h2>
          <p className="overview-subtitle">{t('dashboard.todayWorkload')}</p>
        </div>
        <div className="overview-ring-container" aria-label={`Tiến độ: ${completionPercentage}%`}>
          <svg className="progress-ring" width="76" height="76" viewBox="0 0 76 76">
            <circle
              className="progress-ring-track"
              strokeWidth="6"
              stroke="var(--color-border, #e2e8f0)"
              fill="transparent"
              r="32"
              cx="38"
              cy="38"
            />
            <circle
              className="progress-ring-indicator"
              strokeWidth="6"
              strokeDasharray={201}
              strokeDashoffset={201 - (201 * completionPercentage) / 100}
              strokeLinecap="round"
              stroke="var(--color-primary, #6366f1)"
              fill="transparent"
              r="32"
              cx="38"
              cy="38"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div className="progress-ring-text">
            <span className="percentage-number">{completionPercentage}%</span>
          </div>
        </div>
      </div>

      <div className="overview-metrics-grid">
        <div className="metric-pill">
          <span className="metric-label">{t('dashboard.todayWorkload')}</span>
          <span className="metric-value">{relevantCount}</span>
        </div>
        <div className="metric-pill metric-completed">
          <span className="metric-label">{t('dashboard.completedToday')}</span>
          <span className="metric-value">{completedCount}</span>
        </div>
        <div className="metric-pill metric-remaining">
          <span className="metric-label">{t('dashboard.remaining')}</span>
          <span className="metric-value">{remainingCount}</span>
        </div>
        <div className={`metric-pill metric-overdue ${overdueCount > 0 ? 'has-overdue' : ''}`}>
          <span className="metric-label">{t('dashboard.overdue')}</span>
          <span className="metric-value">{overdueCount}</span>
        </div>
      </div>
    </section>
  )
}
