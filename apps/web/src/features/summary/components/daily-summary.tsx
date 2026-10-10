import React from 'react'
import type { DailySummary as DailySummaryType } from '../types'
import { CarryOverList } from './carry-over-list'
import { CompletedList } from './completed-list'
import { CompletionMetric } from './completion-metric'
import { OverdueSummary } from './overdue-summary'

export interface DailySummaryViewProps {
  summary: DailySummaryType
  timeZone: string
  onSelectTask?: (taskId: string) => void
}

export function DailySummaryView({ summary, timeZone, onSelectTask }: DailySummaryViewProps) {
  return (
    <div className="summary-view-container" data-testid="daily-summary-view">
      <CompletionMetric
        plannedCount={summary.plannedCount}
        completedCount={summary.completedCount}
        completedPlannedCount={summary.completedPlannedCount}
        completionRate={summary.completionRate}
        carryOverCount={summary.carryOverCount}
        overdueCount={summary.overdueCount}
      />

      {summary.overdueCount > 0 && (
        <OverdueSummary tasks={summary.overdueTasks} timeZone={timeZone} onSelectTask={onSelectTask} />
      )}

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
