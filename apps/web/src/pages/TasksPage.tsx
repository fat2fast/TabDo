import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import {
  getThisWeekEnd,
  getTomorrowBoundaries,
  getVisibleRangeForDay,
  isTaskOverdue,
} from '@tabdo/utils'
import { useAuth } from '../features/auth/auth-provider'
import { useI18n } from '../features/i18n/i18n-provider'
import { useScheduleBlocksInRange } from '../features/scheduling/hooks/use-schedule-blocks'
import { CategoryManager } from '../features/tasks/components/category-manager'
import { QuickAddTask } from '../features/tasks/components/quick-add-task'
import { TaskDrawer } from '../features/tasks/components/task-drawer'
import { TaskFilters } from '../features/tasks/components/task-filters'
import { TaskGroup } from '../features/tasks/components/task-group'
import { TaskList } from '../features/tasks/components/task-list'
import { TaskSearch } from '../features/tasks/components/task-search'
import { TaskSort } from '../features/tasks/components/task-sort'
import { TaskViewEmptyState } from '../features/tasks/components/task-view-empty-state'
import { TaskViewHeader } from '../features/tasks/components/task-view-header'
import { useLinkedTasks, useTaskList } from '../features/tasks/hooks/use-tasks'
import { useTaskViewSearchParams } from '../features/tasks/hooks/use-task-view-search-params'
import type { Task, TaskView } from '../features/tasks/types'

export function TasksPage() {
  const { t } = useI18n()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const taskIdParam = searchParams.get('taskId')
  const { profile } = useAuth()
  const timeZone = profile?.timezone || 'Asia/Ho_Chi_Minh'

  // Resolve current view from path
  const currentView: TaskView = useMemo(() => {
    const path = location.pathname.toLowerCase()
    if (path.includes('/tasks/today')) return 'today'
    if (path.includes('/tasks/upcoming')) return 'upcoming'
    if (path.includes('/tasks/overdue')) return 'overdue'
    if (path.includes('/tasks/completed')) return 'completed'
    return 'inbox'
  }, [location.pathname])

  // URL Search and Filter state
  const { params, setParams, clearFilters } = useTaskViewSearchParams()

  // Local UI state (drawer and category manager)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(taskIdParam)
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false)

  // Synchronize when taskId search param changes
  useEffect(() => {
    if (taskIdParam) {
      setSelectedTaskId(taskIdParam)
    }
  }, [taskIdParam])

  const handleCloseDrawer = () => {
    setSelectedTaskId(null)
    if (searchParams.has('taskId')) {
      const next = new URLSearchParams(searchParams)
      next.delete('taskId')
      setSearchParams(next, { replace: true })
    }
  }

  // Stable reference time for queries
  const now = useMemo(() => new Date(), [currentView, params])

  // Fetch tasks for the current view
  const { data: tasks = [], isLoading } = useTaskList({
    view: currentView,
    search: params.search,
    status: params.status,
    priority: params.priority,
    categoryId: params.categoryId,
    dueFrom: params.dueFrom,
    dueTo: params.dueTo,
    sort: params.sort,
    scope: params.scope,
    timeZone,
    now,
  })

  // Visible range for Today view to fetch scheduled blocks
  const todayRange = useMemo(() => {
    if (currentView !== 'today') return null
    return getVisibleRangeForDay(now, timeZone)
  }, [currentView, now, timeZone])

  const { data: scheduleBlocks = [], isLoading: isLoadingSchedules } = useScheduleBlocksInRange({
    startAt: todayRange?.startAt,
    endAt: todayRange?.endAt,
    enabled: currentView === 'today',
  })

  // Derive unique task IDs linked to schedule blocks today
  const scheduledTaskIds = useMemo(() => {
    if (currentView !== 'today') return []
    const ids = new Set<string>()
    for (const block of scheduleBlocks) {
      if (block.taskId) {
        ids.add(block.taskId)
      }
    }
    return Array.from(ids)
  }, [currentView, scheduleBlocks])

  const { data: scheduledTasks = [], isLoading: isLoadingScheduledTasks } = useLinkedTasks(scheduledTaskIds)

  // Combined loading state for page
  const isPageLoading =
    isLoading ||
    (currentView === 'today' &&
      (isLoadingSchedules || (scheduledTaskIds.length > 0 && isLoadingScheduledTasks)))

  // Grouping for Today view: Overdue -> Due Today -> Scheduled Today
  const todayGroups = useMemo(() => {
    if (currentView !== 'today') return null
    const overdueTasks: Task[] = []
    const dueTodayTasks: Task[] = []
    const scheduledTodayTasks: Task[] = []
    const seenTaskIds = new Set<string>()

    // 1. Overdue and Due Today from tasks
    for (const task of tasks) {
      seenTaskIds.add(task.id)
      if (isTaskOverdue(task.dueAt, task.status, now)) {
        overdueTasks.push(task)
      } else {
        dueTodayTasks.push(task)
      }
    }

    // 2. Scheduled Today from scheduledTasks
    // Exclude tasks already shown in earlier groups (seenTaskIds)
    // Exclude completed tasks (must be active: task.status !== 'done')
    // Filter matching current params (search, priority, status, categoryId)
    for (const task of scheduledTasks) {
      if (seenTaskIds.has(task.id)) continue
      if (task.status === 'done') continue

      if (params.search && params.search.trim()) {
        const term = params.search.trim().toLowerCase()
        if (!task.title.toLowerCase().includes(term)) continue
      }
      if (params.status && task.status !== params.status) {
        continue
      }
      if (params.priority && task.priority !== params.priority) {
        continue
      }
      if (params.categoryId !== undefined) {
        if (params.categoryId === null || params.categoryId === 'none') {
          if (task.categoryId !== null) continue
        } else if (params.categoryId !== '') {
          if (task.categoryId !== params.categoryId) continue
        }
      }

      seenTaskIds.add(task.id)
      scheduledTodayTasks.push(task)
    }

    return { overdueTasks, dueTodayTasks, scheduledTodayTasks }
  }, [currentView, tasks, scheduledTasks, now, params])

  // Grouping for Upcoming view
  const upcomingGroups = useMemo(() => {
    if (currentView !== 'upcoming') return null
    const { endOfTomorrow } = getTomorrowBoundaries(now, timeZone)
    const thisWeekEnd = getThisWeekEnd(now, timeZone)

    const tomorrowTasks: Task[] = []
    const thisWeekTasks: Task[] = []
    const laterTasks: Task[] = []

    for (const task of tasks) {
      if (!task.dueAt) continue
      const dueDate = new Date(task.dueAt)
      if (dueDate <= endOfTomorrow) {
        tomorrowTasks.push(task)
      } else if (dueDate <= thisWeekEnd) {
        thisWeekTasks.push(task)
      } else {
        laterTasks.push(task)
      }
    }

    return { tomorrowTasks, thisWeekTasks, laterTasks }
  }, [currentView, tasks, now, timeZone])

  const hasFilters = Boolean(
    params.search ||
      params.status ||
      params.priority ||
      params.categoryId !== undefined ||
      params.dueFrom ||
      params.dueTo ||
      params.scope
  )

  return (
    <div className="tasks-page" data-testid="tasks-page">
      <TaskViewHeader
        currentView={currentView}
        onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
      />

      {/* Show Quick Add on active work views */}
      {currentView !== 'completed' && (
        <QuickAddTask
          defaultCategoryId={
            params.categoryId && params.categoryId !== 'none'
              ? params.categoryId
              : undefined
          }
        />
      )}

      {/* Filter and Search controls */}
      <div className="tasks-controls-card card">
        <div className="controls-row-top">
          <TaskSearch
            value={params.search}
            onChange={(search) => setParams({ search })}
          />

          <TaskSort
            value={params.sort}
            onChange={(sort) => setParams({ sort })}
          />
        </div>

        <TaskFilters
          status={params.status}
          priority={params.priority}
          categoryId={params.categoryId}
          scope={params.scope}
          showStatusFilter={currentView !== 'completed'}
          showScopeFilter={currentView === 'inbox'}
          onStatusChange={(status) => setParams({ status })}
          onPriorityChange={(priority) => setParams({ priority })}
          onCategoryChange={(categoryId) => setParams({ categoryId })}
          onScopeChange={(scope) => setParams({ scope })}
          onClear={clearFilters}
        />
      </div>

      {/* Main Task List Area */}
      <div className="tasks-content-area">
        {isPageLoading ? (
          <div className="task-list-loading" data-testid="tasks-loading">
            <div className="loading-spinner" />
            <span>Đang tải danh sách công việc...</span>
          </div>
        ) : currentView === 'today' && todayGroups ? (
          todayGroups.overdueTasks.length > 0 ||
          todayGroups.dueTodayTasks.length > 0 ||
          todayGroups.scheduledTodayTasks.length > 0 ? (
            <div className="grouped-tasks-container">
              <TaskGroup
                title={t('tasks.groupOverdue')}
                tasks={todayGroups.overdueTasks}
                onSelectTask={setSelectedTaskId}
                badgeVariant="danger"
              />
              <TaskGroup
                title={t('tasks.groupDueToday')}
                tasks={todayGroups.dueTodayTasks}
                onSelectTask={setSelectedTaskId}
                badgeVariant="primary"
              />
              <TaskGroup
                title={t('tasks.groupScheduledToday')}
                tasks={todayGroups.scheduledTodayTasks}
                onSelectTask={setSelectedTaskId}
                badgeVariant="default"
              />
            </div>
          ) : (
            <TaskViewEmptyState
              view={currentView}
              hasFilters={hasFilters}
              onClearFilters={clearFilters}
            />
          )
        ) : currentView === 'upcoming' && upcomingGroups ? (
          upcomingGroups.tomorrowTasks.length > 0 ||
          upcomingGroups.thisWeekTasks.length > 0 ||
          upcomingGroups.laterTasks.length > 0 ? (
            <div className="grouped-tasks-container">
              <TaskGroup
                title={t('tasks.groupTomorrow')}
                tasks={upcomingGroups.tomorrowTasks}
                onSelectTask={setSelectedTaskId}
                badgeVariant="primary"
              />
              <TaskGroup
                title={t('tasks.groupThisWeek')}
                tasks={upcomingGroups.thisWeekTasks}
                onSelectTask={setSelectedTaskId}
                badgeVariant="warning"
              />
              <TaskGroup
                title={t('tasks.groupLater')}
                tasks={upcomingGroups.laterTasks}
                onSelectTask={setSelectedTaskId}
                badgeVariant="default"
              />
            </div>
          ) : (
            <TaskViewEmptyState
              view={currentView}
              hasFilters={hasFilters}
              onClearFilters={clearFilters}
            />
          )
        ) : tasks.length === 0 ? (
          <TaskViewEmptyState
            view={currentView}
            hasFilters={hasFilters}
            onClearFilters={clearFilters}
          />
        ) : (
          <TaskList
            tasks={tasks}
            onSelectTask={setSelectedTaskId}
          />
        )}
      </div>

      {/* Task Detail Modal */}
      <TaskDrawer
        taskId={selectedTaskId}
        onClose={handleCloseDrawer}
        onSelectTask={setSelectedTaskId}
      />

      {/* Category Manager Modal */}
      <CategoryManager
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
      />
    </div>
  )
}
