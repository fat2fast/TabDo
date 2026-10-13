import React, { useState } from 'react'
import type { DashboardMetrics } from '../types'
import { useI18n } from '../../i18n/i18n-provider'

interface TodayOverviewCardProps {
  metrics: DashboardMetrics
  isLoading?: boolean
}

const STORAGE_KEY = 'tabdo:dashboard:overview-collapsed'

export function TodayOverviewCard({ metrics, isLoading }: TodayOverviewCardProps) {
  const { t } = useI18n()
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
    <section
      className={`card dashboard-overview-card ${isCollapsed ? 'is-collapsed' : ''}`}
      aria-label={t('dashboard.todayOverview')}
    >
      <div className="overview-header">
        <div className="overview-header-left">
          <div className="overview-title-row">
            <h2 className="overview-title">{t('dashboard.todayOverview')}</h2>
            {isCollapsed && (
              <span className="overview-mini-badge" title="Tiến độ hôm nay">
                <span className="overview-mini-percent">{completionPercentage}%</span>
                <span className="overview-mini-dot">•</span>
                <span>{relevantCount} {t('dashboard.todayWorkload', 'khối lượng')}</span>
              </span>
            )}
          </div>
          {!isCollapsed && <p className="overview-subtitle">{t('dashboard.todayWorkload')}</p>}
        </div>

        <div className="overview-header-actions">
          {!isCollapsed && (
            <div className="overview-ring-container" aria-label={`Tiến độ: ${completionPercentage}%`}>
              <svg className="progress-ring" width="68" height="68" viewBox="0 0 76 76">
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
          )}

          <button
            type="button"
            className="dashboard-collapse-btn"
            onClick={toggleCollapsed}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? 'Mở rộng tổng quan hôm nay' : 'Thu gọn tổng quan hôm nay'}
            title={isCollapsed ? 'Mở rộng' : 'Thu gọn'}
            data-testid="collapse-overview-btn"
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
      )}
    </section>
  )
}
