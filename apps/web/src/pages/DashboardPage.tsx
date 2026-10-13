import React, { useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { vi } from 'date-fns/locale'
import { useI18n } from '../features/i18n/i18n-provider'
import { useDashboard } from '../features/dashboard/hooks/use-dashboard'
import { TodayOverviewCard } from '../features/dashboard/components/today-overview-card'
import { OverdueTasks } from '../features/dashboard/components/overdue-tasks'
import { PriorityTasks } from '../features/dashboard/components/priority-tasks'
import { TodaySchedule } from '../features/dashboard/components/today-schedule'
import { UpcomingDeadlines } from '../features/dashboard/components/upcoming-deadlines'
import { InProgressTasks } from '../features/dashboard/components/in-progress-tasks'
import { TaskCreateModal } from '../features/tasks/components/task-create-modal'
import { TaskDrawer } from '../features/tasks/components/task-drawer'

export function DashboardPage() {
  const { t, locale } = useI18n()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const {
    snapshot,
    metrics,
    priorityTasks,
    priorityTotal,
    overdueTasks,
    todaySchedule,
    todayScheduleTotal,
    upcomingTasks,
    upcomingTotal,
    inProgressTasks,
    inProgressTotal,
    timeZone,
    isLoading,
    isError,
    error,
    refetch,
  } = useDashboard()

  const now = new Date()
  const formattedDate = formatInTimeZone(
    now,
    timeZone,
    locale === 'vi' ? 'EEEE, dd/MM/yyyy' : 'EEEE, MMMM d, yyyy',
    locale === 'vi' ? { locale: vi } : undefined
  )

  if (isLoading && !snapshot) {
    return (
      <div className="dashboard-page-container" aria-busy="true">
        <header className="dashboard-header">
          <div className="skeleton-line title" style={{ width: 240, height: 28 }} />
          <div className="skeleton-line" style={{ width: 160, height: 18 }} />
        </header>
        <div className="skeleton-card" style={{ height: 160, marginBottom: 24 }} />
        <div className="dashboard-content-grid">
          <div className="dashboard-area-in-progress skeleton-card" style={{ height: 220 }} />
          <div className="dashboard-area-priority skeleton-card" style={{ height: 220 }} />
          <div className="dashboard-area-schedule skeleton-card" style={{ height: 320 }} />
          <div className="dashboard-area-upcoming skeleton-card" style={{ height: 200 }} />
        </div>
      </div>
    )
  }

  if (isError && !snapshot) {
    return (
      <div className="dashboard-page-container">
        <div className="card dashboard-error-card" role="alert">
          <h3>Không thể tải thông tin bảng điều khiển</h3>
          <p>{error?.message || 'Đã có lỗi xảy ra khi kết nối máy chủ.'}</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => refetch()}>
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  const defaultMetrics = metrics || {
    relevantCount: 0,
    completedCount: 0,
    remainingCount: 0,
    overdueCount: 0,
    completionPercentage: 0,
  }

  return (
    <div className="dashboard-page-container">
      <header className="dashboard-header">
        <div className="dashboard-header-text">
          <h1 className="dashboard-heading">{t('dashboard.title')}</h1>
          <p className="dashboard-date-badge">{formattedDate}</p>
        </div>
        <div className="dashboard-header-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsCreateModalOpen(true)}
            data-testid="dashboard-create-task-btn"
          >
            + {t('dashboard.createTask')}
          </button>
        </div>
      </header>

      {/* Top Overview Progress Card */}
      <TodayOverviewCard metrics={defaultMetrics} isLoading={isLoading && !snapshot} />

      {/* Overdue Alert Banner if overdue tasks exist */}
      <OverdueTasks
        tasks={overdueTasks}
        timeZone={timeZone}
        onSelectTask={(id: string) => setSelectedTaskId(id)}
      />

      {/* Main Responsive Dashboard Grid */}
      <div className="dashboard-content-grid">
        <InProgressTasks
          tasks={inProgressTasks ?? []}
          total={inProgressTotal ?? 0}
          timeZone={timeZone}
          onCreateTask={() => setIsCreateModalOpen(true)}
          onSelectTask={(id: string) => setSelectedTaskId(id)}
        />
        <PriorityTasks
          tasks={priorityTasks}
          total={priorityTotal}
          timeZone={timeZone}
          onCreateTask={() => setIsCreateModalOpen(true)}
          onSelectTask={(id: string) => setSelectedTaskId(id)}
        />
        <TodaySchedule
          schedule={todaySchedule}
          total={todayScheduleTotal}
          timeZone={timeZone}
          onSelectTask={(id: string) => setSelectedTaskId(id)}
        />
        <UpcomingDeadlines
          tasks={upcomingTasks}
          total={upcomingTotal}
          timeZone={timeZone}
          onSelectTask={(id: string) => setSelectedTaskId(id)}
        />
      </div>

      <TaskCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onTaskCreated={() => refetch()}
      />

      {selectedTaskId && (
        <TaskDrawer
          taskId={selectedTaskId}
          onClose={() => {
            setSelectedTaskId(null)
            refetch()
          }}
          onSelectTask={(id) => setSelectedTaskId(id)}
        />
      )}
    </div>
  )
}
