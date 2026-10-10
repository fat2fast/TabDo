import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatInTimeZone } from 'date-fns-tz'
import { useAuth } from '../features/auth/auth-provider'
import { useI18n } from '../features/i18n/i18n-provider'
import { DailySummaryView } from '../features/summary/components/daily-summary'
import { SummaryPeriodControls } from '../features/summary/components/summary-period-controls'
import { WeeklySummaryView } from '../features/summary/components/weekly-summary'
import { useSummary } from '../features/summary/hooks/use-summary'
import type { SummaryPeriod } from '../features/summary/types'
import { TaskDrawer } from '../features/tasks/components/task-drawer'

export function SummaryPage() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const timeZone = profile?.timezone || 'Asia/Ho_Chi_Minh'

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()

  const rawPeriod = searchParams.get('period')
  const period: SummaryPeriod = rawPeriod === 'weekly' ? 'weekly' : 'daily'

  const rawDate = searchParams.get('date')
  const todayStr = formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd')
  const isValidDatePattern = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
  const selectedDateStr = isValidDatePattern ? rawDate : todayStr

  const { summary, isLoading, isError, error, refetch } = useSummary({
    period,
    selectedDateStr,
  })

  const handlePeriodChange = (newPeriod: SummaryPeriod) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('period', newPeriod)
      if (!next.get('date')) {
        next.set('date', selectedDateStr)
      }
      return next
    }, { replace: true })
  }

  const handleDateChange = (newDateStr: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('date', newDateStr)
      if (!next.get('period')) {
        next.set('period', period)
      }
      return next
    }, { replace: true })
  }

  if (isLoading && !summary) {
    return (
      <div className="summary-page-container" aria-busy="true" data-testid="summary-loading">
        <header className="summary-header">
          <div className="skeleton-line title" style={{ width: 220, height: 28 }} />
        </header>
        <div className="skeleton-card" style={{ height: 60, marginBottom: 16 }} />
        <div className="skeleton-card" style={{ height: 180, marginBottom: 16 }} />
        <div className="skeleton-card" style={{ height: 320 }} />
      </div>
    )
  }

  if (isError && !summary) {
    return (
      <div className="summary-page-container">
        <div className="card summary-error-card" role="alert" data-testid="summary-error-card">
          <h3 className="text-danger">{t('summary.errorTitle')}</h3>
          <p>{error?.message || t('summary.errorTitle')}</p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => refetch()}
            data-testid="summary-retry-btn"
          >
            {t('summary.retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="summary-page-container">
      <header className="summary-header">
        <h1 className="summary-page-title">{t('summary.title')}</h1>
      </header>

      {/* Approximation Notice Banner */}
      <div className="summary-notice-banner" role="note" data-testid="summary-notice-banner">
        <span className="summary-notice-icon" aria-hidden="true">ℹ️</span>
        <span className="summary-notice-text">{t('summary.approximationNotice')}</span>
      </div>

      {/* Period Tabs & Navigation */}
      <SummaryPeriodControls
        period={period}
        selectedDateStr={selectedDateStr}
        timeZone={timeZone}
        onPeriodChange={handlePeriodChange}
        onDateChange={handleDateChange}
      />

      {/* Main Review View */}
      {summary && summary.period === 'daily' && (
        <DailySummaryView summary={summary} timeZone={timeZone} onSelectTask={setSelectedTaskId} />
      )}

      {summary && summary.period === 'weekly' && (
        <WeeklySummaryView summary={summary} timeZone={timeZone} onSelectTask={setSelectedTaskId} />
      )}

      {/* Task Detail Modal */}
      <TaskDrawer
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onSelectTask={setSelectedTaskId}
      />
    </div>
  )
}
