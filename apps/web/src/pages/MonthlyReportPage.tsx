import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { formatTaskDueDate } from '@tabdo/utils'
import { useAuth } from '../features/auth/auth-provider'
import { useI18n } from '../features/i18n/i18n-provider'
import { CustomDropdown, type DropdownOption } from '../components/ui/custom-dropdown'
import { DatePicker } from '../components/ui/date-picker'
import {
  calculateReportRange,
  fetchMonthlyReportCandidateTasks,
} from '../features/summary/monthly-report/monthly-task-query'
import { mapTasksToReportData } from '../features/summary/monthly-report/monthly-report-data'
import {
  downloadReportXlsx,
  generateReportXlsx,
} from '../features/summary/monthly-report/export-xlsx'
import type {
  ReportPeriod,
  ReportPeriodType,
} from '../features/summary/monthly-report/types'

export function MonthlyReportPage() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const timeZone = profile?.timezone || 'Asia/Ho_Chi_Minh'

  const zonedNow = useMemo(() => toZonedTime(new Date(), timeZone), [timeZone])
  const currentYear = zonedNow.getFullYear()
  const currentMonth = zonedNow.getMonth() + 1 // 1-12
  const currentQuarter = Math.floor(zonedNow.getMonth() / 3) + 1 // 1-4
  const todayStr = useMemo(
    () => formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd'),
    [timeZone]
  )
  const defaultMonthStartStr = useMemo(
    () => `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`,
    [currentYear, currentMonth]
  )

  // Period State
  const [periodType, setPeriodType] = useState<ReportPeriodType>('monthly')
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth)
  const [selectedQuarter, setSelectedQuarter] = useState<number>(currentQuarter)
  const [startDateStr, setStartDateStr] = useState<string>(defaultMonthStartStr)
  const [endDateStr, setEndDateStr] = useState<string>(todayStr)

  // Attribute Filters State (in parallel with period filtering)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // Derive report period
  const reportPeriod: ReportPeriod = useMemo(() => {
    if (periodType === 'monthly') {
      const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
      return { type: 'monthly', monthStr }
    }
    if (periodType === 'quarterly') {
      return { type: 'quarterly', year: selectedYear, quarter: selectedQuarter }
    }
    return { type: 'custom', startDateStr, endDateStr }
  }, [periodType, selectedYear, selectedMonth, selectedQuarter, startDateStr, endDateStr])

  // Derive report range
  const reportRange = useMemo(() => {
    try {
      return calculateReportRange(reportPeriod, timeZone)
    } catch {
      // Fallback if inputs are mid-edit
      return calculateReportRange(
        {
          type: 'monthly',
          monthStr: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
        },
        timeZone
      )
    }
  }, [reportPeriod, timeZone, currentYear, currentMonth])

  // Query candidate tasks
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [
      'monthly-report-candidates',
      reportRange.startAt,
      reportRange.endAt,
      timeZone,
    ],
    queryFn: () => fetchMonthlyReportCandidateTasks({ range: reportRange }),
  })

  // Select all candidate tasks by default when data loads
  useEffect(() => {
    if (data?.candidates) {
      setSelectedTaskIds(new Set(data.candidates.map((c) => c.task.id)))
    }
  }, [data?.candidates])

  // Period Type options
  const periodTypeOptions: DropdownOption<string>[] = useMemo(
    () => [
      { value: 'monthly', label: t('monthlyReport.typeMonth') },
      { value: 'quarterly', label: t('monthlyReport.typeQuarter') },
      { value: 'custom', label: t('monthlyReport.typeCustom') },
    ],
    [t]
  )

  // Quarter options for CustomDropdown
  const quarterOptions: DropdownOption<string>[] = useMemo(
    () => [
      { value: '1', label: `${t('monthlyReport.quarter')} 1 (T1 - T3)` },
      { value: '2', label: `${t('monthlyReport.quarter')} 2 (T4 - T6)` },
      { value: '3', label: `${t('monthlyReport.quarter')} 3 (T7 - T9)` },
      { value: '4', label: `${t('monthlyReport.quarter')} 4 (T10 - T12)` },
    ],
    [t]
  )

  // Month options for CustomDropdown
  const monthOptions: DropdownOption<string>[] = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      return {
        value: String(m),
        label: `Tháng ${m}`,
      }
    })
  }, [])

  // Year options for CustomDropdown (dynamically calculated based on current year + task history)
  const yearOptions: DropdownOption<string>[] = useMemo(() => {
    const yearsSet = new Set<number>()
    // Include dynamic rolling window: 5 years in the past up to 2 years in the future
    for (let y = currentYear - 5; y <= currentYear + 2; y++) {
      yearsSet.add(y)
    }
    if (selectedYear) {
      yearsSet.add(selectedYear)
    }
    // Include any years present in historical candidate tasks
    if (data?.candidates) {
      for (const c of data.candidates) {
        const dateStr = c.task.dueAt || c.task.completedAt || c.task.createdAt
        if (dateStr) {
          const y = new Date(dateStr).getFullYear()
          if (!isNaN(y)) {
            yearsSet.add(y)
          }
        }
      }
    }
    return Array.from(yearsSet)
      .sort((a, b) => a - b)
      .map((y) => ({
        value: String(y),
        label: `Năm ${y}`,
      }))
  }, [currentYear, selectedYear, data?.candidates])

  // Status filter options
  const statusOptions: DropdownOption<string>[] = useMemo(
    () => [
      { value: 'all', label: t('monthlyReport.allStatuses') },
      { value: 'done', label: t('monthlyReport.statusDone') },
      { value: 'in_progress', label: t('monthlyReport.statusInProgress') },
      { value: 'todo', label: t('monthlyReport.statusTodo') },
    ],
    [t]
  )

  // Category filter options
  const categoryOptions: DropdownOption<string>[] = useMemo(() => {
    const opts: DropdownOption<string>[] = [
      { value: 'all', label: t('monthlyReport.allCategories') },
      { value: 'uncategorized', label: t('monthlyReport.uncategorized') },
    ]
    if (data?.categories) {
      for (const cat of data.categories) {
        opts.push({
          value: cat.id,
          label: cat.name,
        })
      }
    }
    return opts
  }, [data?.categories, t])

  // Candidates filtering
  const candidates = data?.candidates || []
  const filteredCandidates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return candidates.filter((c) => {
      // 1. Status filter
      if (statusFilter !== 'all' && c.task.status !== statusFilter) {
        return false
      }
      // 2. Category filter
      if (categoryFilter !== 'all') {
        if (categoryFilter === 'uncategorized') {
          if (c.task.categoryId) return false
        } else {
          if (c.task.categoryId !== categoryFilter) return false
        }
      }
      // 3. Quick search filter (title, description, category)
      if (query) {
        const titleMatch = c.task.title.toLowerCase().includes(query)
        const descMatch = c.task.description?.toLowerCase().includes(query) ?? false
        const catMatch = c.categoryName.toLowerCase().includes(query)
        if (!titleMatch && !descMatch && !catMatch) {
          return false
        }
      }
      return true
    })
  }, [candidates, statusFilter, categoryFilter, searchQuery])

  // Selected candidates among filtered
  const selectedCandidates = useMemo(
    () => filteredCandidates.filter((c) => selectedTaskIds.has(c.task.id)),
    [filteredCandidates, selectedTaskIds]
  )
  const uniqueSelectedGroups = useMemo(
    () => Array.from(new Set(selectedCandidates.map((c) => c.categoryName))),
    [selectedCandidates]
  )

  const isAllFilteredSelected =
    filteredCandidates.length > 0 &&
    filteredCandidates.every((c) => selectedTaskIds.has(c.task.id))

  const handleToggleTask = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev)
      for (const c of filteredCandidates) {
        next.add(c.task.id)
      }
      return next
    })
  }

  const handleDeselectAll = () => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev)
      for (const c of filteredCandidates) {
        next.delete(c.task.id)
      }
      return next
    })
  }

  const handleExport = async () => {
    if (isExporting) return
    setIsExporting(true)
    setExportError(null)

    try {
      // 1. Map report data
      const selectedTasks = selectedCandidates.map((c) => c.task)
      const categories = data?.categories || []
      const reportData = mapTasksToReportData({
        selectedTasks,
        categories,
        profile,
        range: reportRange,
      })

      // 2. Fetch clean template
      const response = await fetch('/report-templates/monthly-work-report-v1.xlsx')
      if (!response.ok) {
        throw new Error(`Failed to load template file: ${response.statusText}`)
      }
      const templateArrayBuffer = await response.arrayBuffer()
      const templateBytes = new Uint8Array(templateArrayBuffer)

      // 3. Generate XLSX
      const outputBytes = generateReportXlsx(reportData, templateBytes)

      // 4. Download file
      const blob = new Blob([outputBytes as unknown as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const filename = `${reportRange.fileSlug}-bao-cao-cong-viec.xlsx`
      downloadReportXlsx(blob, filename)
    } catch (err) {
      console.error('Export failed:', err)
      setExportError(
        err instanceof Error ? err.message : t('monthlyReport.exportError')
      )
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="monthly-report-page-container">
      {/* Header */}
      <header className="monthly-report-header">
        <div className="header-title-group">
          <Link
            to="/summary"
            className="btn btn-secondary btn-sm"
            data-testid="monthly-report-back-btn"
          >
            <span aria-hidden="true">←</span> {t('monthlyReport.back')}
          </Link>
          <div>
            <h1 className="monthly-report-title">{t('monthlyReport.title')}</h1>
            <p className="monthly-report-subtitle">{t('monthlyReport.subtitle')}</p>
          </div>
        </div>
      </header>

      {/* Control Card: Period Type Selector & Attribute Filters & Export CTA */}
      <div className="card report-controls-card">
        {/* Row 1: Period Selection */}
        <div className="report-controls-row period-row">
          <div className="picker-item picker-item-sm">
            <CustomDropdown
              label={t('monthlyReport.periodType')}
              value={periodType}
              options={periodTypeOptions}
              onChange={(val) => setPeriodType(val as ReportPeriodType)}
              id="monthly-report-period-type"
              testId="monthly-report-period-type"
            />
          </div>

          {periodType === 'monthly' && (
            <>
              <div className="picker-item picker-item-sm">
                <CustomDropdown
                  label={t('monthlyReport.month')}
                  value={String(selectedMonth)}
                  options={monthOptions}
                  onChange={(val) => setSelectedMonth(parseInt(val, 10))}
                  id="monthly-report-month-select"
                  testId="monthly-report-month-select"
                />
              </div>
              <div className="picker-item picker-item-sm">
                <CustomDropdown
                  label={t('monthlyReport.year')}
                  value={String(selectedYear)}
                  options={yearOptions}
                  onChange={(val) => setSelectedYear(parseInt(val, 10))}
                  id="monthly-report-year-select"
                  testId="monthly-report-year-select"
                />
              </div>
            </>
          )}

          {periodType === 'quarterly' && (
            <>
              <div className="picker-item picker-item-sm">
                <CustomDropdown
                  label={t('monthlyReport.quarter')}
                  value={String(selectedQuarter)}
                  options={quarterOptions}
                  onChange={(val) => setSelectedQuarter(parseInt(val, 10))}
                  id="monthly-report-quarter-select"
                  testId="monthly-report-quarter-select"
                />
              </div>
              <div className="picker-item picker-item-sm">
                <CustomDropdown
                  label={t('monthlyReport.year')}
                  value={String(selectedYear)}
                  options={yearOptions}
                  onChange={(val) => setSelectedYear(parseInt(val, 10))}
                  id="monthly-report-year-select"
                  testId="monthly-report-year-select"
                />
              </div>
            </>
          )}

          {periodType === 'custom' && (
            <>
              <div className="picker-item picker-item-sm">
                <DatePicker
                  label={t('monthlyReport.fromDate')}
                  value={startDateStr}
                  onChange={(val) => {
                    if (val) {
                      setStartDateStr(val)
                      if (endDateStr && endDateStr < val) {
                        setEndDateStr(val)
                      }
                    }
                  }}
                  timeZone={timeZone}
                  id="report-from-date"
                  testId="report-from-date-input"
                />
              </div>
              <div className="picker-item picker-item-sm">
                <DatePicker
                  label={t('monthlyReport.toDate')}
                  value={endDateStr}
                  onChange={(val) => {
                    if (val) {
                      setEndDateStr(val)
                      if (startDateStr && startDateStr > val) {
                        setStartDateStr(val)
                      }
                    }
                  }}
                  timeZone={timeZone}
                  id="report-to-date"
                  testId="report-to-date-input"
                />
              </div>
            </>
          )}
        </div>

        {/* Row 2: Status & Category below "Loại", Export button on bottom right */}
        <div className="report-controls-row filter-action-row">
          <div className="report-filters-group">
            <div className="picker-item picker-item-sm">
              <CustomDropdown
                label={t('monthlyReport.filterStatus')}
                value={statusFilter}
                options={statusOptions}
                onChange={(val) => setStatusFilter(val)}
                id="monthly-report-status-filter"
                testId="monthly-report-status-filter"
              />
            </div>
            <div className="picker-item picker-item-sm">
              <CustomDropdown
                label={t('monthlyReport.filterCategory')}
                value={categoryFilter}
                options={categoryOptions}
                onChange={(val) => setCategoryFilter(val)}
                id="monthly-report-category-filter"
                testId="monthly-report-category-filter"
              />
            </div>
          </div>

          <div className="report-actions-group">
            {exportError && (
              <div className="alert alert-danger report-export-error-inline" role="alert" data-testid="export-error-alert">
                {exportError}
              </div>
            )}
            <button
              type="button"
              className="btn btn-primary report-export-submit-btn"
              onClick={handleExport}
              disabled={isExporting || isLoading}
              data-testid="report-export-btn"
            >
              {isExporting ? (
                <>
                  <span className="spinner-sm" aria-hidden="true" />
                  <span>{t('monthlyReport.exporting')}</span>
                </>
              ) : (
                <>
                  <span aria-hidden="true">📥</span>
                  <span>{t('monthlyReport.exportBtn')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Notice Banner */}
      <div className="report-notice-banner" role="note" data-testid="report-notice-banner">
        <span className="notice-icon" aria-hidden="true">💡</span>
        <span className="notice-text">{t('monthlyReport.notice')}</span>
      </div>

      {/* Tasks Candidate Section */}
      <div className="card report-tasks-card">
        <div className="report-tasks-header">
          <div>
            <h2 className="report-tasks-title">{t('monthlyReport.selectTasksTitle')}</h2>
            <div className="report-tasks-counts" data-testid="report-tasks-counter">
              {statusFilter !== 'all' || categoryFilter !== 'all' || searchQuery.trim() !== '' ? (
                <>
                  Đã chọn <strong>{selectedCandidates.length}</strong> / {filteredCandidates.length} công việc hiển thị{' '}
                  ({uniqueSelectedGroups.length} nhóm) &bull;{' '}
                  <span className="text-muted">Tổng trong kỳ: {candidates.length}</span>
                </>
              ) : (
                <>
                  Đã chọn <strong>{selectedCandidates.length}</strong> / {candidates.length} công việc{' '}
                  ({uniqueSelectedGroups.length} nhóm)
                </>
              )}
            </div>
          </div>
          <div className="report-tasks-actions">
            <button
              type="button"
              className="btn btn-ghost-sm"
              onClick={handleSelectAll}
              disabled={isAllFilteredSelected || filteredCandidates.length === 0}
              data-testid="select-all-btn"
            >
              {t('monthlyReport.selectAll')}
            </button>
            <button
              type="button"
              className="btn btn-ghost-sm"
              onClick={handleDeselectAll}
              disabled={selectedCandidates.length === 0}
              data-testid="deselect-all-btn"
            >
              {t('monthlyReport.deselectAll')}
            </button>
          </div>
        </div>

        {/* Quick Search Toolbar */}
        <div className="report-tasks-search-bar">
          <div className="report-search-input-wrapper">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              className="report-search-input"
              placeholder={t('monthlyReport.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="report-tasks-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                title="Xóa tìm kiếm"
                aria-label="Clear search"
                data-testid="report-tasks-search-clear"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Content list */}
        {isLoading ? (
          <div className="report-loading-state" aria-busy="true" data-testid="report-loading">
            <div className="skeleton-line" style={{ width: '40%', height: 20, marginBottom: 12 }} />
            <div className="skeleton-line" style={{ width: '100%', height: 48, marginBottom: 8 }} />
            <div className="skeleton-line" style={{ width: '100%', height: 48, marginBottom: 8 }} />
            <div className="skeleton-line" style={{ width: '100%', height: 48 }} />
          </div>
        ) : isError ? (
          <div className="report-error-state" role="alert" data-testid="report-load-error">
            <p className="text-danger">{error?.message || t('monthlyReport.loadError')}</p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => refetch()}
            >
              {t('common.retry')}
            </button>
          </div>
        ) : candidates.length === 0 ? (
          <div className="report-empty-state" data-testid="report-empty-tasks">
            <p className="text-muted">{t('monthlyReport.noTasksFound')}</p>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="report-empty-state" data-testid="report-empty-filtered-tasks">
            <p className="text-muted">{t('monthlyReport.noFilteredTasksFound')}</p>
          </div>
        ) : (
          <div className="report-task-list" role="list">
            {filteredCandidates.map((candidate) => {
              const isSelected = selectedTaskIds.has(candidate.task.id)
              const statusBadgeClass =
                candidate.task.status === 'done'
                  ? 'status-badge-done'
                  : candidate.task.status === 'in_progress'
                  ? 'status-badge-in-progress'
                  : 'status-badge-todo'
              const statusBadgeText =
                candidate.task.status === 'done'
                  ? 'Hoàn thành'
                  : candidate.task.status === 'in_progress'
                  ? 'Đang thực hiện'
                  : 'Chưa thực hiện'

              const dueFormatted = candidate.task.dueAt
                ? formatTaskDueDate(
                    candidate.task.dueAt,
                    candidate.task.dueDateKind,
                    timeZone
                  )
                : '—'

              return (
                <div
                  key={candidate.task.id}
                  className={`report-task-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleToggleTask(candidate.task.id)}
                  data-testid={`report-task-item-${candidate.task.id}`}
                >
                  <label
                    className="task-checkbox-label"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleTask(candidate.task.id)}
                      data-testid={`task-checkbox-${candidate.task.id}`}
                    />
                  </label>
                  <div className="task-content">
                    <div className="task-title-line">
                      <span className="task-title">{candidate.task.title}</span>
                    </div>
                    <div className="task-metadata-line">
                      <span className="badge category-badge">
                        {candidate.categoryName}
                      </span>
                      <span className="task-due-date">
                        <span aria-hidden="true">⏰</span> {dueFormatted}
                      </span>
                      <span className={`badge ${statusBadgeClass}`}>
                        {statusBadgeText}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
