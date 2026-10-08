import React from 'react'
import { NavLink } from 'react-router-dom'
import { useI18n } from '../../i18n/i18n-provider'
import type { TaskView } from '../types'

export interface TaskViewHeaderProps {
  currentView: TaskView
  onOpenCategoryManager: () => void
}

const VIEW_ICONS: Record<TaskView, string> = {
  inbox: '📋',
  today: '☀️',
  upcoming: '📅',
  overdue: '⚠️',
  completed: '✅',
}

export function TaskViewHeader({
  currentView,
  onOpenCategoryManager,
}: TaskViewHeaderProps) {
  const { t } = useI18n()

  const getTitle = (view: TaskView) => {
    switch (view) {
      case 'inbox':
        return t('tasks.viewInboxTitle')
      case 'today':
        return t('tasks.viewTodayTitle')
      case 'upcoming':
        return t('tasks.viewUpcomingTitle')
      case 'overdue':
        return t('tasks.viewOverdueTitle')
      case 'completed':
        return t('tasks.viewCompletedTitle')
      default:
        return t('tasks.viewInboxTitle')
    }
  }

  const getSubtitle = (view: TaskView) => {
    switch (view) {
      case 'inbox':
        return t('tasks.viewInboxSubtitle')
      case 'today':
        return t('tasks.viewTodaySubtitle')
      case 'upcoming':
        return t('tasks.viewUpcomingSubtitle')
      case 'overdue':
        return t('tasks.viewOverdueSubtitle')
      case 'completed':
        return t('tasks.viewCompletedSubtitle')
      default:
        return t('tasks.viewInboxSubtitle')
    }
  }

  const icon = VIEW_ICONS[currentView] || VIEW_ICONS.inbox

  return (
    <div className="task-view-header" data-testid="task-view-header">
      <div className="header-top-row">
        <div className="view-title-block">
          <h2>
            <span className="view-icon">{icon}</span> {getTitle(currentView)}
          </h2>
          <p className="view-subtitle">{getSubtitle(currentView)}</p>
        </div>

        <button
          type="button"
          className="btn-category-mgr"
          onClick={onOpenCategoryManager}
          data-testid="open-category-manager-btn"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          {t('tasks.manageCategories')}
        </button>
      </div>

      <nav className="task-view-tabs" aria-label="Smart views navigation">
        <NavLink
          to="/tasks/inbox"
          className={({ isActive }) =>
            `view-tab ${isActive || currentView === 'inbox' ? 'active' : ''}`
          }
        >
          {t('tasks.tabInbox')}
        </NavLink>
        <NavLink
          to="/tasks/today"
          className={({ isActive }) =>
            `view-tab ${isActive ? 'active' : ''}`
          }
        >
          {t('tasks.tabToday')}
        </NavLink>
        <NavLink
          to="/tasks/upcoming"
          className={({ isActive }) =>
            `view-tab ${isActive ? 'active' : ''}`
          }
        >
          {t('tasks.tabUpcoming')}
        </NavLink>
        <NavLink
          to="/tasks/overdue"
          className={({ isActive }) =>
            `view-tab ${isActive ? 'active' : ''}`
          }
        >
          {t('tasks.tabOverdue')}
        </NavLink>
        <NavLink
          to="/tasks/completed"
          className={({ isActive }) =>
            `view-tab ${isActive ? 'active' : ''}`
          }
        >
          {t('tasks.tabCompleted')}
        </NavLink>
      </nav>
    </div>
  )
}
