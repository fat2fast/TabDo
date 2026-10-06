import React, { useState } from 'react'
import {
  formatReminderDisplay,
  resolveRelativeReminderInstant,
  resolveSnoozeInstant,
} from '@tabdo/utils'
import { useAuth } from '../../auth/auth-provider'
import type { Task } from '../../tasks/types'
import { useReminderMutations } from '../hooks/use-reminder-mutations'
import { useRemindersByTask } from '../hooks/use-reminders'
import type { Reminder } from '../types'
import { ReminderEditor } from './reminder-editor'
import { ReminderPresetPicker } from './reminder-preset-picker'

export interface ReminderListProps {
  task: Task
}

export function ReminderList({ task }: ReminderListProps) {
  const { profile } = useAuth()
  const timeZone = profile?.timezone || 'Asia/Ho_Chi_Minh'

  const { data: reminders = [], isLoading } = useRemindersByTask(task.id)
  const {
    createMutation,
    snoozeMutation,
    dismissMutation,
    deleteMutation,
  } = useReminderMutations()

  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)
  const [presetOffset, setPresetOffset] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSelectPreset = async (offsetMinutes: number) => {
    setErrorMsg(null)
    if (!task.dueAt) return

    try {
      const calculatedInstant = resolveRelativeReminderInstant(task.dueAt, offsetMinutes)
      if (new Date(calculatedInstant).getTime() <= Date.now()) {
        setErrorMsg('Thời điểm nhắc nhở tính toán đã ở trong quá khứ.')
        return
      }

      await createMutation.mutateAsync({
        taskId: task.id,
        reminderKind: 'relative_due',
        offsetMinutes,
        remindAt: calculatedInstant,
      })
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi tạo lời nhắc từ thiết lập nhanh.')
    }
  }

  const handleCustomClick = () => {
    setEditingReminder(null)
    setPresetOffset(null)
    setIsEditorOpen(true)
    setErrorMsg(null)
  }

  const handleEdit = (rem: Reminder) => {
    setEditingReminder(rem)
    setPresetOffset(null)
    setIsEditorOpen(true)
    setErrorMsg(null)
  }

  const handleSnooze = async (rem: Reminder, minutes: number) => {
    setErrorMsg(null)
    try {
      const snoozeInstant = resolveSnoozeInstant(new Date(), minutes)
      await snoozeMutation.mutateAsync({
        id: rem.id,
        snoozedUntil: snoozeInstant,
        previousUpdatedAt: rem.updatedAt,
      })
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi hoãn lời nhắc.')
    }
  }

  const handleDismiss = async (rem: Reminder) => {
    setErrorMsg(null)
    try {
      await dismissMutation.mutateAsync({
        id: rem.id,
        previousUpdatedAt: rem.updatedAt,
      })
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi đóng lời nhắc.')
    }
  }

  const handleDelete = async (rem: Reminder) => {
    setErrorMsg(null)
    try {
      await deleteMutation.mutateAsync({
        id: rem.id,
        previousUpdatedAt: rem.updatedAt,
        taskId: task.id,
      })
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi xóa lời nhắc.')
    }
  }

  return (
    <div className="tabdo-reminder-list-section" data-testid="task-reminders-section">
      <div className="sidebar-box-header">
        <span className="sidebar-header-icon">⏰</span>
        <span className="sidebar-box-title">Lời nhắc</span>
        <span className="count-badge">{reminders.length}</span>
      </div>

      {errorMsg && (
        <div className="form-error-banner" role="alert" data-testid="reminder-list-error">
          {errorMsg}
        </div>
      )}

      {isLoading ? (
        <div className="reminders-loading">Đang tải lời nhắc...</div>
      ) : reminders.length === 0 ? (
        <div className="no-reminders-hint">Chưa thiết lập lời nhắc nào cho công việc này.</div>
      ) : (
        <div className="reminders-items-container">
          {reminders.map((rem) => {
            const isSnoozed = rem.status === 'snoozed'
            const isDismissed = rem.status === 'dismissed'
            const isPending = rem.status === 'pending'

            return (
              <div
                key={rem.id}
                className={`reminder-item-card status-${rem.status}`}
                data-testid={`reminder-item-${rem.id}`}
              >
                <div className="reminder-item-main">
                  <div className="reminder-item-time">
                    <span>
                      {isSnoozed ? '💤 Hoãn đến: ' : '⏰ '}
                      {formatReminderDisplay(rem.effectiveAt, timeZone)}
                    </span>
                    <span className="reminder-kind-tag">
                      {rem.reminderKind === 'relative_due'
                        ? rem.offsetMinutes === 0
                          ? 'Đúng hạn'
                          : `Trước ${rem.offsetMinutes}m`
                        : 'Cố định'}
                    </span>
                  </div>

                  {isDismissed && <div className="reminder-status-note">Đã đóng</div>}
                </div>

                <div className="reminder-item-actions">
                  {!isDismissed && (
                    <>
                      <button
                        type="button"
                        className="btn btn-icon btn-xs"
                        onClick={() => handleSnooze(rem, 15)}
                        title="Hoãn 15 phút"
                        data-testid={`snooze-15-${rem.id}`}
                      >
                        💤
                      </button>
                      <button
                        type="button"
                        className="btn btn-icon btn-xs"
                        onClick={() => handleDismiss(rem)}
                        title="Bỏ qua lời nhắc"
                        data-testid={`dismiss-${rem.id}`}
                      >
                        ✓
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="btn btn-icon btn-xs"
                    onClick={() => handleEdit(rem)}
                    title="Chỉnh sửa"
                    data-testid={`edit-reminder-${rem.id}`}
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon btn-xs btn-danger-hover"
                    onClick={() => handleDelete(rem)}
                    title="Xóa"
                    data-testid={`delete-reminder-${rem.id}`}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Preset Picker */}
      <div className="reminder-add-controls">
        <ReminderPresetPicker
          task={task}
          onSelectPreset={handleSelectPreset}
          onCustomClick={handleCustomClick}
        />
      </div>

      <ReminderEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        task={task}
        initialReminder={editingReminder}
        initialOffsetMinutes={presetOffset}
      />
    </div>
  )
}
