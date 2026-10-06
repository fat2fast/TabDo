import React from 'react'
import { formatDisplayDate } from '@tabdo/utils'
import { useAuth } from '../../auth/auth-provider'
import type { ScheduleBlock } from '../types'

export interface ScheduleBlockCardProps {
  block: ScheduleBlock
  onEdit?: (block: ScheduleBlock) => void
  onDelete?: (block: ScheduleBlock) => void
}

export function ScheduleBlockCard({ block, onEdit, onDelete }: ScheduleBlockCardProps) {
  const { profile } = useAuth()
  const timeZone = profile?.timezone || 'Asia/Ho_Chi_Minh'

  const startDate = new Date(block.startAt)
  const endDate = new Date(block.endAt)

  const dateStr = formatDisplayDate(startDate, timeZone, 'dd/MM/yyyy')
  const startTimeStr = formatDisplayDate(startDate, timeZone, 'HH:mm')
  const endTimeStr = formatDisplayDate(endDate, timeZone, 'HH:mm')
  const diffMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000)
  const durationStr =
    diffMinutes < 60
      ? `${diffMinutes}p`
      : `${Math.floor(diffMinutes / 60)}h${diffMinutes % 60 ? `${diffMinutes % 60}p` : ''}`

  return (
    <div className="schedule-block-card" data-testid={`schedule-block-card-${block.id}`}>
      <div className="schedule-card-main">
        <div className="schedule-card-time">
          <span className="time-badge">
            📅 {dateStr} • {startTimeStr} - {endTimeStr}
          </span>
          {diffMinutes > 0 && <span className="duration-pill">{durationStr}</span>}
        </div>
        <div className="schedule-card-title">{block.title}</div>
      </div>

      <div className="schedule-card-actions">
        {onEdit && (
          <button
            type="button"
            className="btn btn-icon btn-sm"
            onClick={() => onEdit(block)}
            title="Chỉnh sửa lịch"
            data-testid={`edit-schedule-block-${block.id}`}
          >
            ✏️
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            className="btn btn-icon btn-sm btn-danger-hover"
            onClick={() => onDelete(block)}
            title="Xóa lịch"
            data-testid={`delete-schedule-block-${block.id}`}
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  )
}
