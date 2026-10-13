import React from 'react'
import { NavLink } from 'react-router-dom'
import { useI18n } from '../../i18n/i18n-provider'
import type { TaskLayout, TaskView } from '../types'

export interface TaskViewHeaderProps {
  currentView: TaskView
  layout?: TaskLayout
  onLayoutChange?: (layout: TaskLayout) => void
  onOpenCategoryManager: () => void
  onOpenCreateModal?: () => void
}

const VIEW_ICONS: Record<TaskView, string> = {
  inbox: '📋',
  today: '☀️',
  upcoming: '📅',
  overdue: '⚠️',
  completed: '✅',
  trash: '🗑️',
}

export function TaskViewHeader({
  currentView,
  layout = 'list',
  onLayoutChange,
  onOpenCategoryManager,
  onOpenCreateModal,
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
      case 'trash':
        return t('tasks.viewTrashTitle')
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
      case 'trash':
        return t('tasks.viewTrashSubtitle')
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

        <div className="header-actions-group">
          {/* List / Board Layout Toggle (Above the smart tabs) */}
          {onLayoutChange && currentView !== 'trash' && (
            <div
              className="layout-toggle-group header-layout-toggle"
              role="group"
              aria-label="Chế độ hiển thị"
              data-testid="layout-toggle"
            >
              <button
                type="button"
                className={`layout-toggle-btn ${layout !== 'board' ? 'active' : ''}`}
                onClick={() => onLayoutChange('list')}
                aria-pressed={layout !== 'board'}
                aria-label={t('tasks.viewModeList')}
                title={t('tasks.viewModeList')}
                data-testid="toggle-layout-list"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                <span className="layout-toggle-label">{t('tasks.viewModeList')}</span>
              </button>
              <button
                type="button"
                className={`layout-toggle-btn ${layout === 'board' ? 'active' : ''}`}
                onClick={() => onLayoutChange('board')}
                aria-pressed={layout === 'board'}
                aria-label={t('tasks.viewModeBoard')}
                title={t('tasks.viewModeBoard')}
                data-testid="toggle-layout-board"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="3" width="5" height="18" rx="1.5" />
                  <rect x="10.5" y="3" width="5" height="13" rx="1.5" />
                  <rect x="18" y="3" width="5" height="16" rx="1.5" />
                </svg>
                <span className="layout-toggle-label">{t('tasks.viewModeBoard')}</span>
              </button>
            </div>
          )}

          {onOpenCreateModal && currentView !== 'trash' && (
            <button
              type="button"
              className="btn btn-primary btn-sm btn-header-create-task"
              onClick={onOpenCreateModal}
              data-testid="header-create-task-btn"
            >
              + Tạo công việc
            </button>
          )}

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
      </div>

      {/* Smart views navigation tabs ONLY shown in list mode */}
      {layout !== 'board' && (
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
          <NavLink
            to="/tasks/trash"
            className={({ isActive }) =>
              `view-tab ${isActive ? 'active' : ''}`
            }
          >
            {t('tasks.tabTrash')}
          </NavLink>
        </nav>
      )}
    </div>
  )
}
