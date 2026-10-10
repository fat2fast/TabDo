import React from 'react'
import { useI18n } from '../../i18n/i18n-provider'
import type { WeeklySummary as WeeklySummaryType } from '../types'
import { CarryOverList } from './carry-over-list'
import { CategoryBreakdown } from './category-breakdown'
import { CompletedList } from './completed-list'
import { CompletionMetric } from './completion-metric'
import { OverdueSummary } from './overdue-summary'
import { WeeklyCompletionChart } from './weekly-completion-chart'

export interface WeeklySummaryViewProps {
  summary: WeeklySummaryType
  timeZone: string
  onSelectTask?: (taskId: string) => void
}

export function WeeklySummaryView({ summary, timeZone, onSelectTask }: WeeklySummaryViewProps) {
  const { t } = useI18n()
  const comp = summary.comparisonVsPreviousWeek

  return (
    <div className="summary-view-container" data-testid="weekly-summary-view">
      <CompletionMetric
        plannedCount={summary.plannedCount}
        completedCount={summary.completedCount}
        completedPlannedCount={summary.completedPlannedCount}
        completionRate={summary.completionRate}
        carryOverCount={summary.carryOverCount}
        overdueCount={summary.overdueCount}
      />

      {/* Previous Week Comparison Card */}
      <div className="card summary-comparison-card" data-testid="summary-comparison-card">
        <h3 className="summary-section-title">
          {t('summary.previousWeekComparisonTitle')}
        </h3>

        {comp ? (
          <div className="summary-comparison-grid">
            <div className="summary-comparison-item">
              <span className="summary-comparison-label">
                {t('summary.completedCount')}
              </span>
              <div className="summary-comparison-vals">
                <span className="summary-comparison-curr">{summary.completedCount}</span>
                <span className="summary-comparison-prev">
                  vs {comp.previousCompletedCount}
                </span>
                <span
                  className={`summary-diff-badge ${
                    comp.diffCompletedCount >= 0 ? 'is-positive' : 'is-negative'
                  }`}
                >
                  {comp.diffCompletedCount >= 0 ? `+${comp.diffCompletedCount}` : comp.diffCompletedCount}{' '}
                  {t('summary.previousWeekCountDiff')}
                </span>
              </div>
            </div>

            <div className="summary-comparison-item">
              <span className="summary-comparison-label">
                {t('summary.completionRate')}
              </span>
              <div className="summary-comparison-vals">
                <span className="summary-comparison-curr">
                  {summary.completionRate !== null
                    ? `${Math.round(summary.completionRate * 100)}%`
                    : '—'}
                </span>
                <span className="summary-comparison-prev">
                  vs{' '}
                  {comp.previousRate !== null
                    ? `${Math.round(comp.previousRate * 100)}%`
                    : '—'}
                </span>
                {comp.rateDiffPercentagePoints !== null && (
                  <span
                    className={`summary-diff-badge ${
                      comp.rateDiffPercentagePoints >= 0 ? 'is-positive' : 'is-negative'
                    }`}
                  >
                    {comp.rateDiffPercentagePoints >= 0
                      ? `+${comp.rateDiffPercentagePoints}`
                      : comp.rateDiffPercentagePoints}{' '}
                    {t('summary.previousWeekRateDiff')}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="summary-empty-text">{t('summary.noPreviousData')}</p>
        )}
      </div>

      {/* 7-day completion chart */}
      <WeeklyCompletionChart
        breakdown={summary.dailyBreakdown}
        mostProductiveDay={summary.mostProductiveDay}
      />

      {/* Category breakdown */}
      <CategoryBreakdown
        categories={summary.categoryBreakdown}
        totalCompleted={summary.completedCount}
      />

      {summary.overdueCount > 0 && (
        <OverdueSummary tasks={summary.overdueTasks} timeZone={timeZone} onSelectTask={onSelectTask} />
      )}

      {/* Detailed task lists */}
      <div className="summary-columns-grid">
        <div className="summary-column">
          <CompletedList tasks={summary.completedTasks} timeZone={timeZone} onSelectTask={onSelectTask} />
        </div>
        <div className="summary-column">
          <CarryOverList tasks={summary.carryOverTasks} timeZone={timeZone} onSelectTask={onSelectTask} />
          {summary.overdueCount === 0 && (
            <OverdueSummary tasks={summary.overdueTasks} timeZone={timeZone} onSelectTask={onSelectTask} />
          )}
        </div>
      </div>
    </div>
  )
}
