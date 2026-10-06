import React, { useState } from 'react'
import type { Task } from '../../tasks/types'
import { ScheduleEditor } from './schedule-editor'

export interface ScheduleTaskActionProps {
  task: Task
  onScheduled?: () => void
}

export function ScheduleTaskAction({ task, onScheduled }: ScheduleTaskActionProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary btn-sm schedule-task-action-btn"
        onClick={() => setIsOpen(true)}
        data-testid="schedule-task-btn"
      >
        <span>+</span> Lên lịch làm việc
      </button>

      {isOpen && (
        <ScheduleEditor
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          initialTask={task}
          onSuccess={() => {
            onScheduled?.()
          }}
        />
      )}
    </>
  )
}
