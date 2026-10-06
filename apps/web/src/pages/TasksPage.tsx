import React, { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  getThisWeekEnd,
  getTomorrowBoundaries,
  isTaskOverdue,
} from '@tabdo/utils'
import { useAuth } from '../features/auth/auth-provider'
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
import { useTaskList } from '../features/tasks/hooks/use-tasks'
import { useTaskViewSearchParams } from '../features/tasks/hooks/use-task-view-search-params'
import type { Task, TaskView } from '../features/tasks/types'

export function TasksPage() {
  const location = useLocation()
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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false)

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
    timeZone,
    now,
  })

  // Grouping for Today view
  const todayGroups = useMemo(() => {
    if (currentView !== 'today') return null
    const overdueTasks: Task[] = []
    const dueTodayTasks: Task[] = []

    for (const task of tasks) {
      if (isTaskOverdue(task.dueAt, task.status, now)) {
        overdueTasks.push(task)
      } else {
        dueTodayTasks.push(task)
      }
    }

    return { overdueTasks, dueTodayTasks }
  }, [currentView, tasks, now])

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
      params.dueTo
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
          showStatusFilter={currentView !== 'completed' && currentView !== 'inbox'}
          onStatusChange={(status) => setParams({ status })}
          onPriorityChange={(priority) => setParams({ priority })}
          onCategoryChange={(categoryId) => setParams({ categoryId })}
          onClear={clearFilters}
        />
      </div>

      {/* Main Task List Area */}
      <div className="tasks-content-area">
        {isLoading ? (
          <div className="task-list-loading" data-testid="tasks-loading">
            <div className="loading-spinner" />
            <span>Đang tải danh sách công việc...</span>
          </div>
        ) : tasks.length === 0 ? (
          <TaskViewEmptyState
            view={currentView}
            hasFilters={hasFilters}
            onClearFilters={clearFilters}
          />
        ) : currentView === 'today' && todayGroups ? (
          <div className="grouped-tasks-container">
            <TaskGroup
              title="Quá hạn"
              tasks={todayGroups.overdueTasks}
              onSelectTask={setSelectedTaskId}
              badgeVariant="danger"
            />
            <TaskGroup
              title="Hôm nay"
              tasks={todayGroups.dueTodayTasks}
              onSelectTask={setSelectedTaskId}
              badgeVariant="primary"
            />
          </div>
        ) : currentView === 'upcoming' && upcomingGroups ? (
          <div className="grouped-tasks-container">
            <TaskGroup
              title="Ngày mai"
              tasks={upcomingGroups.tomorrowTasks}
              onSelectTask={setSelectedTaskId}
              badgeVariant="primary"
            />
            <TaskGroup
              title="Tuần này"
              tasks={upcomingGroups.thisWeekTasks}
              onSelectTask={setSelectedTaskId}
              badgeVariant="warning"
            />
            <TaskGroup
              title="Sau này"
              tasks={upcomingGroups.laterTasks}
              onSelectTask={setSelectedTaskId}
              badgeVariant="default"
            />
          </div>
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
        onClose={(savedTask) => {
          setSelectedTaskId(null)
          if (savedTask?.categoryId && currentView === 'inbox' && !params.categoryId) {
            setParams({ categoryId: savedTask.categoryId })
          }
        }}
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
