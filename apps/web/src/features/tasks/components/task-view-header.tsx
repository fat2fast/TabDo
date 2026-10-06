import React from 'react'
import { NavLink } from 'react-router-dom'
import type { TaskView } from '../types'

export interface TaskViewHeaderProps {
  currentView: TaskView
  onOpenCategoryManager: () => void
}

const VIEW_METADATA: Record<TaskView, { title: string; subtitle: string; icon: string }> = {
  inbox: {
    title: 'Hộp thư đến (Inbox)',
    subtitle: 'Công việc mới chưa phân loại hoặc chưa có hạn chót',
    icon: '📥',
  },
  today: {
    title: 'Hôm nay (Today)',
    subtitle: 'Các công việc cần sự chú ý trong ngày hôm nay',
    icon: '☀️',
  },
  upcoming: {
    title: 'Sắp tới (Upcoming)',
    subtitle: 'Các công việc có hạn chót sau hôm nay',
    icon: '📅',
  },
  overdue: {
    title: 'Quá hạn (Overdue)',
    subtitle: 'Các công việc chưa hoàn thành đã quá hạn chót',
    icon: '⚠️',
  },
  completed: {
    title: 'Đã hoàn thành (Completed)',
    subtitle: 'Lịch sử các công việc bạn đã hoàn thành gần đây',
    icon: '✅',
  },
}

export function TaskViewHeader({
  currentView,
  onOpenCategoryManager,
}: TaskViewHeaderProps) {
  const meta = VIEW_METADATA[currentView] || VIEW_METADATA.inbox

  return (
    <div className="task-view-header" data-testid="task-view-header">
      <div className="header-top-row">
        <div className="view-title-block">
          <h2>
            <span className="view-icon">{meta.icon}</span> {meta.title}
          </h2>
          <p className="view-subtitle">{meta.subtitle}</p>
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
          Quản lý danh mục
        </button>
      </div>

      <nav className="task-view-tabs" aria-label="Smart views navigation">
        <NavLink
          to="/tasks/inbox"
          className={({ isActive }) =>
            `view-tab ${isActive || currentView === 'inbox' ? 'active' : ''}`
          }
        >
          Inbox
        </NavLink>
        <NavLink
          to="/tasks/today"
          className={({ isActive }) =>
            `view-tab ${isActive ? 'active' : ''}`
          }
        >
          Hôm nay
        </NavLink>
        <NavLink
          to="/tasks/upcoming"
          className={({ isActive }) =>
            `view-tab ${isActive ? 'active' : ''}`
          }
        >
          Sắp tới
        </NavLink>
        <NavLink
          to="/tasks/overdue"
          className={({ isActive }) =>
            `view-tab ${isActive ? 'active' : ''}`
          }
        >
          Quá hạn
        </NavLink>
        <NavLink
          to="/tasks/completed"
          className={({ isActive }) =>
            `view-tab ${isActive ? 'active' : ''}`
          }
        >
          Đã xong
        </NavLink>
      </nav>
    </div>
  )
}
