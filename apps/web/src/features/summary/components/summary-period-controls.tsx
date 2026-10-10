import React from 'react'
import { addDays } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { vi } from 'date-fns/locale'
import {
  getSummaryRangeForWeek,
  parseLocalDateReference,
} from '@tabdo/utils'
import { DatePicker } from '../../../components/ui/date-picker'
import { useI18n } from '../../i18n/i18n-provider'
import type { SummaryPeriod } from '../types'

export interface SummaryPeriodControlsProps {
  period: SummaryPeriod
  selectedDateStr: string
  timeZone: string
  onPeriodChange: (period: SummaryPeriod) => void
  onDateChange: (dateStr: string) => void
}

export function SummaryPeriodControls({
  period,
  selectedDateStr,
  timeZone,
  onPeriodChange,
  onDateChange,
}: SummaryPeriodControlsProps) {
  const { t, locale } = useI18n()

  const currentRef = parseLocalDateReference(selectedDateStr, timeZone)

  const handlePrevious = () => {
    const shift = period === 'weekly' ? -7 : -1
    const newRef = addDays(currentRef, shift)
    const newDateStr = formatInTimeZone(newRef, timeZone, 'yyyy-MM-dd')
    onDateChange(newDateStr)
  }

  const handleNext = () => {
    const shift = period === 'weekly' ? 7 : 1
    const newRef = addDays(currentRef, shift)
    const newDateStr = formatInTimeZone(newRef, timeZone, 'yyyy-MM-dd')
    onDateChange(newDateStr)
  }

  const handleToday = () => {
    const todayStr = formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd')
    onDateChange(todayStr)
  }

  let formattedDateDisplay = ''
  if (period === 'weekly') {
    const { startAt, endAt } = getSummaryRangeForWeek(selectedDateStr, timeZone)
    // Week start is Monday, week end is Sunday (endAt - 1 day)
    const mondayStr = formatInTimeZone(new Date(startAt), timeZone, 'dd/MM/yyyy')
    const sundayStr = formatInTimeZone(
      new Date(new Date(endAt).getTime() - 1000),
      timeZone,
      'dd/MM/yyyy'
    )
    formattedDateDisplay = `${mondayStr} – ${sundayStr}`
  } else {
    formattedDateDisplay = formatInTimeZone(
      currentRef,
      timeZone,
      locale === 'vi' ? 'EEEE, dd/MM/yyyy' : 'EEEE, MMMM d, yyyy',
      locale === 'vi' ? { locale: vi } : undefined
    )
  }

  return (
    <div className="summary-controls-bar">
      {/* Period Tabs */}
      <div
        className="summary-period-tabs"
        role="tablist"
        aria-label={t('summary.periodAria')}
      >
        <button
          type="button"
          role="tab"
          aria-selected={period === 'daily'}
          className={`summary-tab-btn ${period === 'daily' ? 'is-active' : ''}`}
          onClick={() => onPeriodChange('daily')}
          data-testid="tab-daily"
        >
          {t('summary.dailyTab')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={period === 'weekly'}
          className={`summary-tab-btn ${period === 'weekly' ? 'is-active' : ''}`}
          onClick={() => onPeriodChange('weekly')}
          data-testid="tab-weekly"
        >
          {t('summary.weeklyTab')}
        </button>
      </div>

      {/* Center: Date Navigation & Display */}
      <div className="summary-nav-cluster">
        <div className="summary-date-display">
          <span className="summary-display-badge">{formattedDateDisplay}</span>
        </div>

        <div className="summary-nav-buttons">
          <button
            type="button"
            className="btn btn-secondary btn-sm summary-nav-btn"
            onClick={handlePrevious}
            title={period === 'weekly' ? t('summary.previousWeek') : t('summary.previousDay')}
            aria-label={period === 'weekly' ? t('summary.previousWeek') : t('summary.previousDay')}
            data-testid="summary-prev-btn"
          >
            ←
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm summary-today-btn"
            onClick={handleToday}
            data-testid="summary-today-btn"
          >
            {t('summary.todayButton')}
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm summary-nav-btn"
            onClick={handleNext}
            title={period === 'weekly' ? t('summary.nextWeek') : t('summary.nextDay')}
            aria-label={period === 'weekly' ? t('summary.nextWeek') : t('summary.nextDay')}
            data-testid="summary-next-btn"
          >
            →
          </button>
        </div>
      </div>

      {/* Right: Date Picker */}
      <div className="summary-date-picker-wrap">
        <DatePicker
          value={selectedDateStr}
          onChange={(d) => d && onDateChange(d)}
          timeZone={timeZone}
          placeholder={t('summary.selectDate')}
          testId="summary-date-picker"
        />
      </div>
    </div>
  )
}
