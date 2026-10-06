import React from 'react'
import type { Task } from '../types'
import { TaskEmptyState } from './task-empty-state'
import { TaskRow } from './task-row'

export interface TaskListProps {
  tasks: Task[]
  isLoading?: boolean
  onSelectTask: (taskId: string) => void
  emptyTitle?: string
  emptyDescription?: string
}

export function TaskList({
  tasks,
  isLoading,
  onSelectTask,
  emptyTitle,
  emptyDescription,
}: TaskListProps) {
  if (isLoading) {
    return (
      <div className="task-list-loading" data-testid="task-list-loading">
        <div className="loading-spinner" />
        <span>Đang tải danh sách công việc...</span>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <TaskEmptyState
        title={emptyTitle || 'Chưa có công việc nào.'}
        description={emptyDescription || 'Tạo công việc đầu tiên để bắt đầu.'}
      />
    )
  }

  return (
    <div className="task-list" data-testid="task-list">
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          onSelect={onSelectTask}
        />
      ))}
    </div>
  )
}
