import React from 'react'
import { useI18n } from '../../i18n/i18n-provider'
import type { DayCompletedBreakdown, WeeklySummary } from '../types'

export interface WeeklyCompletionChartProps {
  breakdown: DayCompletedBreakdown[]
  mostProductiveDay: WeeklySummary['mostProductiveDay']
}

export function WeeklyCompletionChart({
  breakdown,
  mostProductiveDay,
}: WeeklyCompletionChartProps) {
  const { t } = useI18n()

  const maxCount = Math.max(...breakdown.map((b) => b.count), 1)

  return (
    <div className="card summary-section-card" data-testid="summary-weekly-chart">
      <div className="summary-section-header">
        <h3 className="summary-section-title">{t('summary.sevenDayChartTitle')}</h3>
        {mostProductiveDay ? (
          <div className="summary-peak-day-badge" data-testid="summary-peak-day">
            ⭐ {t('summary.mostProductiveDay')}: <strong>{t(mostProductiveDay.dayLabelKey as any)}</strong> ({mostProductiveDay.count})
          </div>
        ) : (
          <div className="summary-peak-day-badge is-muted">
            {t('summary.noProductiveDay')}
          </div>
        )}
      </div>

      <div className="summary-chart-container" role="img" aria-label={t('summary.sevenDayChartTitle')}>
        <div className="summary-chart-bars">
          {breakdown.map((day) => {
            const isPeak = mostProductiveDay?.dateStr === day.dateStr && day.count > 0
            const heightPercent = day.count > 0 ? Math.max(16, (day.count / maxCount) * 100) : 6
            const dayName = t(day.dayLabelKey as any)
            const shortDate = day.dateStr.slice(5).replace('-', '/') // MM/DD

            return (
              <div
                key={day.dateStr}
                className="summary-chart-col"
                aria-label={`${dayName} (${shortDate}): ${day.count}`}
              >
                <div className="summary-chart-count">{day.count}</div>
                <div className="summary-chart-bar-track">
                  <div
                    className={`summary-chart-bar ${isPeak ? 'is-peak' : ''}`}
                    style={{ height: `${heightPercent}%` }}
                  />
                </div>
                <span className="summary-chart-day-label">{dayName}</span>
                <span className="summary-chart-date-label">{shortDate}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
