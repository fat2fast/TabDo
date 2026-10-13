import React, { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useTaskViewSearchParams } from '../hooks/use-task-view-search-params'
import type { TaskView } from '../types'
import { TaskSearch } from './task-search'
import { TaskFiltersPopover } from './task-filters-popover'
import { TaskSort } from './task-sort'

export function TaskTopBarControls() {
  const location = useLocation()
  const { params, setParams, clearFilters } = useTaskViewSearchParams()

  const currentView: TaskView = useMemo(() => {
    const path = location.pathname.toLowerCase()
    if (path.includes('/tasks/today')) return 'today'
    if (path.includes('/tasks/upcoming')) return 'upcoming'
    if (path.includes('/tasks/overdue')) return 'overdue'
    if (path.includes('/tasks/completed')) return 'completed'
    if (path.includes('/tasks/trash')) return 'trash'
    return 'inbox'
  }, [location.pathname])

  if (currentView === 'trash') {
    return null
  }

  return (
    <div className="task-topbar-controls" data-testid="task-topbar-controls">
      <div className="topbar-search-box">
        <TaskSearch
          value={params.search}
          onChange={(search) => setParams({ search })}
        />
      </div>

      <div className="topbar-filters-box">
        <TaskFiltersPopover
          status={params.status}
          priority={params.priority}
          categoryId={params.categoryId}
          scope={params.scope}
          completedRange={params.completedRange}
          showStatusFilter={currentView !== 'completed'}
          showScopeFilter={currentView === 'inbox'}
          showCompletedFilter={currentView === 'completed' || params.status === 'done'}
          onStatusChange={(status) => setParams({ status })}
          onPriorityChange={(priority) => setParams({ priority })}
          onCategoryChange={(categoryId) => setParams({ categoryId })}
          onScopeChange={(scope) => setParams({ scope })}
          onCompletedRangeChange={(completedRange) => setParams({ completedRange })}
          onClear={clearFilters}
        />

        <TaskSort
          value={params.sort}
          onChange={(sort) => setParams({ sort })}
        />
      </div>
    </div>
  )
}
