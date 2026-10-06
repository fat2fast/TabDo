import React from 'react'
import { RELATIVE_REMINDER_PRESETS } from '@tabdo/utils'
import type { Task } from '../../tasks/types'

export interface ReminderPresetPickerProps {
  task: Task
  onSelectPreset: (offsetMinutes: number) => void
  onCustomClick: () => void
}

export function ReminderPresetPicker({
  task,
  onSelectPreset,
  onCustomClick,
}: ReminderPresetPickerProps) {
  const hasTimedDue = Boolean(task.dueAt && task.dueDateKind === 'date_time')

  return (
    <div className="tabdo-reminder-preset-picker" data-testid="reminder-preset-picker">
      <div className="preset-options-group">
        {RELATIVE_REMINDER_PRESETS.map((preset) => (
          <button
            key={preset.offsetMinutes}
            type="button"
            className="btn btn-outline btn-xs preset-btn"
            disabled={!hasTimedDue}
            onClick={() => onSelectPreset(preset.offsetMinutes)}
            title={
              !hasTimedDue
                ? 'Cần đặt hạn chót có giờ cụ thể để dùng lời nhắc theo hạn'
                : preset.label
            }
            data-testid={`preset-btn-${preset.offsetMinutes}`}
          >
            {preset.label}
          </button>
        ))}

        <button
          type="button"
          className="btn btn-outline btn-xs custom-preset-btn"
          onClick={onCustomClick}
          title="Tạo lời nhắc vào thời điểm cố định"
          data-testid="custom-reminder-btn"
        >
          🕒 Tùy chỉnh giờ...
        </button>
      </div>

      {!hasTimedDue && (
        <div className="preset-disabled-hint" data-testid="relative-disabled-hint">
          💡 Đặt hạn chót có giờ cụ thể để kích hoạt các lời nhắc theo hạn chót.
        </div>
      )}
    </div>
  )
}
