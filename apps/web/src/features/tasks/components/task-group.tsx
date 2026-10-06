import React from 'react'
import type { Task } from '../types'
import { TaskRow } from './task-row'

export interface TaskGroupProps {
  title: string
  tasks: Task[]
  onSelectTask: (taskId: string) => void
  badgeVariant?: 'default' | 'danger' | 'warning' | 'primary'
}

export function TaskGroup({
  title,
  tasks,
  onSelectTask,
  badgeVariant = 'default',
}: TaskGroupProps) {
  if (tasks.length === 0) return null

  return (
    <div className="task-group-container" data-testid={`task-group-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="task-group-header">
        <h4 className="task-group-title">{title}</h4>
        <span className={`task-group-count badge-${badgeVariant}`}>
          {tasks.length}
        </span>
      </div>

      <div className="task-group-items">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onSelect={onSelectTask}
          />
        ))}
      </div>
    </div>
  )
}
