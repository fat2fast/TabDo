import React from 'react'

export interface TaskEmptyStateProps {
  title?: string
  description?: string
  children?: React.ReactNode
}

export function TaskEmptyState({
  title = 'Chưa có công việc nào.',
  description = 'Tạo công việc đầu tiên để bắt đầu.',
  children,
}: TaskEmptyStateProps) {
  return (
    <div className="task-empty-state" data-testid="task-empty-state">
      <div className="empty-state-icon">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {children && <div className="empty-state-action">{children}</div>}
    </div>
  )
}
