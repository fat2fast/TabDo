import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useSafeSearchParams } from '../features/pwa/use-safe-search-params'
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
import { TaskBoard } from '../features/tasks/components/task-board'
import { TaskCreateModal } from '../features/tasks/components/task-create-modal'
import { TaskDrawer } from '../features/tasks/components/task-drawer'
import { TaskGroup } from '../features/tasks/components/task-group'
import { TaskList } from '../features/tasks/components/task-list'
import { TaskTrash } from '../features/tasks/components/task-trash'
import { TaskViewEmptyState } from '../features/tasks/components/task-view-empty-state'
import { TaskViewHeader } from '../features/tasks/components/task-view-header'
import { useCategories } from '../features/tasks/hooks/use-categories'
import { useLinkedTasks, useTaskList } from '../features/tasks/hooks/use-tasks'
import { useTaskViewSearchParams } from '../features/tasks/hooks/use-task-view-search-params'
import type { Task, TaskView } from '../features/tasks/types'

export function TasksPage() {
  const { t } = useI18n()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSafeSearchParams()
  const taskIdParam = searchParams.get('taskId')
  const { profile } = useAuth()
  const timeZone = profile?.timezone || 'Asia/Ho_Chi_Minh'
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createModalInitialTitle, setCreateModalInitialTitle] = useState('')

  const { data: categories = [] } = useCategories()
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  // Resolve current view from path
  const currentView: TaskView = useMemo(() => {
    const path = location.pathname.toLowerCase()
    if (path.includes('/tasks/today')) return 'today'
    if (path.includes('/tasks/upcoming')) return 'upcoming'
    if (path.includes('/tasks/overdue')) return 'overdue'
    if (path.includes('/tasks/completed')) return 'completed'
    if (path.includes('/tasks/trash')) return 'trash'
    return 'inbox'
  }, [location.pathname])

  // URL Search and Filter state
  const { params, setLayout, clearFilters } = useTaskViewSearchParams()

  // Local UI state (drawer and category manager)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(taskIdParam)
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false)
  const isPushedToHistoryRef = useRef(false)

  // Synchronize when taskId search param changes (both directions, including null)
  useEffect(() => {
    setSelectedTaskId(taskIdParam || null)
    if (!taskIdParam) {
      isPushedToHistoryRef.current = false
    }
  }, [taskIdParam])

  // Select task from list / board / group / trash: push to URL history
  const handleSelectTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId)
    isPushedToHistoryRef.current = true
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('taskId', taskId)
      return next
    })
  }, [setSearchParams])

  // Select task inside drawer (subtask / parent switch): replace URL to avoid close loop
  const handleSelectDrawerTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('taskId', taskId)
      return next
    }, { replace: true })
  }, [setSearchParams])

  const handleCloseDrawer = useCallback(() => {
    setSelectedTaskId(null)
    if (isPushedToHistoryRef.current && typeof window !== 'undefined' && window.history.length > 1) {
      isPushedToHistoryRef.current = false
      window.history.back()
    } else {
      isPushedToHistoryRef.current = false
      if (searchParams.has('taskId')) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev)
          next.delete('taskId')
          return next
        }, { replace: true })
      }
    }
  }, [searchParams, setSearchParams])

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
    completedFrom: params.completedFrom,
    completedTo: params.completedTo,
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
        const matchTitle = task.title.toLowerCase().includes(term)
        const matchDesc = task.description ? task.description.toLowerCase().includes(term) : false
        const matchCategory = task.categoryId
          ? categoryMap.get(task.categoryId)?.name.toLowerCase().includes(term)
          : false
        if (!matchTitle && !matchDesc && !matchCategory) continue
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
  }, [currentView, tasks, scheduledTasks, now, params, categoryMap])

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
        layout={params.layout}
        onLayoutChange={setLayout}
        onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
        onOpenCreateModal={() => {
          setCreateModalInitialTitle('')
          setIsCreateModalOpen(true)
        }}
      />

      {/* Show Quick Add only on active work views and when NOT in board layout */}
      {currentView !== 'completed' && currentView !== 'trash' && params.layout !== 'board' && (
        <QuickAddTask
          defaultCategoryId={
            params.categoryId && params.categoryId !== 'none'
              ? params.categoryId
              : undefined
          }
          onOpenDetailedCreate={(title?: string) => {
            setCreateModalInitialTitle(title || '')
            setIsCreateModalOpen(true)
          }}
        />
      )}

      {currentView === 'trash' ? (
        <TaskTrash onSelectTask={handleSelectTask} />
      ) : (
        <>
          {/* Main Task List Area */}
          <div className="tasks-content-area">
            {params.layout === 'board' ? (
              <TaskBoard
                currentView={currentView}
                params={params}
                onSelectTask={handleSelectTask}
                now={now}
              />
            ) : isPageLoading ? (
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
                    onSelectTask={handleSelectTask}
                    badgeVariant="danger"
                  />
                  <TaskGroup
                    title={t('tasks.groupDueToday')}
                    tasks={todayGroups.dueTodayTasks}
                    onSelectTask={handleSelectTask}
                    badgeVariant="primary"
                  />
                  <TaskGroup
                    title={t('tasks.groupScheduledToday')}
                    tasks={todayGroups.scheduledTodayTasks}
                    onSelectTask={handleSelectTask}
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
                    onSelectTask={handleSelectTask}
                    badgeVariant="primary"
                  />
                  <TaskGroup
                    title={t('tasks.groupThisWeek')}
                    tasks={upcomingGroups.thisWeekTasks}
                    onSelectTask={handleSelectTask}
                    badgeVariant="warning"
                  />
                  <TaskGroup
                    title={t('tasks.groupLater')}
                    tasks={upcomingGroups.laterTasks}
                    onSelectTask={handleSelectTask}
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
                onSelectTask={handleSelectTask}
              />
            )}
          </div>
        </>
      )}

      {/* Task Detail Modal */}
      <TaskDrawer
        taskId={selectedTaskId}
        onClose={handleCloseDrawer}
        onSelectTask={handleSelectDrawerTask}
      />

      {/* Category Manager Modal */}
      <CategoryManager
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
      />

      {/* Detailed Task Create Modal */}
      <TaskCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        initialTitle={createModalInitialTitle}
        defaultCategoryId={
          params.categoryId && params.categoryId !== 'none'
            ? params.categoryId
            : undefined
        }
      />
    </div>
  )
}
