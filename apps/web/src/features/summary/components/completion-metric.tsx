import React from 'react'
import { useI18n } from '../../i18n/i18n-provider'

export interface CompletionMetricProps {
  plannedCount: number
  completedCount: number
  completedPlannedCount: number
  completionRate: number | null
  carryOverCount: number
  overdueCount: number
}

export function CompletionMetric({
  plannedCount,
  completedCount,
  completedPlannedCount,
  completionRate,
  carryOverCount,
  overdueCount,
}: CompletionMetricProps) {
  const { t } = useI18n()

  const percentage = completionRate !== null ? Math.round(completionRate * 100) : null
  const radius = 32
  const stroke = 6
  const normalizedRadius = radius - stroke * 2
  const circumference = normalizedRadius * 2 * Math.PI
  const strokeDashoffset =
    percentage !== null
      ? circumference - (percentage / 100) * circumference
      : circumference

  return (
    <div className="card summary-overview-card" data-testid="summary-completion-metric">
      <div className="summary-overview-header">
        <div className="summary-overview-info">
          <h2 className="summary-card-title">{t('summary.completionRate')}</h2>
          <p className="summary-card-subtitle">
            {plannedCount > 0
              ? `${completedPlannedCount}/${plannedCount} ${t('summary.completedPlannedCount').toLowerCase()}`
              : t('summary.noPlannedTasks')}
          </p>
        </div>

        <div className="summary-ring-container" aria-hidden="true">
          <svg height={radius * 2} width={radius * 2} className="summary-progress-ring">
            <circle
              stroke="var(--color-border, #e2e8f0)"
              fill="transparent"
              strokeWidth={stroke}
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
            {percentage !== null && (
              <circle
                stroke={percentage >= 80 ? '#10b981' : percentage >= 50 ? '#3b82f6' : '#f59e0b'}
                fill="transparent"
                strokeWidth={stroke}
                strokeDasharray={`${circumference} ${circumference}`}
                style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                strokeLinecap="round"
                r={normalizedRadius}
                cx={radius}
                cy={radius}
              />
            )}
          </svg>
          <div className="summary-ring-text">
            {percentage !== null ? `${percentage}%` : '—'}
          </div>
        </div>
      </div>

      <div className="summary-stats-grid">
        <div className="summary-stat-box">
          <span className="summary-stat-label">{t('summary.plannedCount')}</span>
          <span className="summary-stat-value" data-testid="metric-planned-count">
            {plannedCount}
          </span>
        </div>

        <div className="summary-stat-box">
          <span className="summary-stat-label">{t('summary.completedCount')}</span>
          <span className="summary-stat-value text-success" data-testid="metric-completed-count">
            {completedCount}
          </span>
        </div>

        <div className="summary-stat-box">
          <span className="summary-stat-label">{t('summary.carryOverCount')}</span>
          <span className="summary-stat-value text-warning" data-testid="metric-carryover-count">
            {carryOverCount}
          </span>
        </div>

        <div className="summary-stat-box">
          <span className="summary-stat-label">{t('summary.overdueCount')}</span>
          <span
            className={`summary-stat-value ${overdueCount > 0 ? 'text-danger' : ''}`}
            data-testid="metric-overdue-count"
          >
            {overdueCount}
          </span>
        </div>
      </div>
    </div>
  )
}
