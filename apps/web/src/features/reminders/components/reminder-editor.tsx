import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  formatReminderDisplay,
  fromScheduleInstant,
  parseScheduleLocalDateTime,
  resolveRelativeReminderInstant,
  resolveSnoozeInstant,
  SNOOZE_PRESETS,
} from '@tabdo/utils'
import { useAuth } from '../../auth/auth-provider'
import type { Task } from '../../tasks/types'
import { useReminderMutations } from '../hooks/use-reminder-mutations'
import type { Reminder, ReminderKind } from '../types'
import { CustomDropdown } from '../../../components/ui/custom-dropdown'
import { DatePicker } from '../../../components/ui/date-picker'
import { TimePicker24h } from '../../../components/ui/time-picker-24h'

export interface ReminderEditorProps {
  isOpen: boolean
  onClose: () => void
  task: Task
  initialReminder?: Reminder | null
  initialOffsetMinutes?: number | null
}

export function ReminderEditor({
  isOpen,
  onClose,
  task,
  initialReminder,
  initialOffsetMinutes,
}: ReminderEditorProps) {
  const { profile } = useAuth()
  const timeZone = profile?.timezone || 'Asia/Ho_Chi_Minh'
  const hasTimedDue = Boolean(task.dueAt && task.dueDateKind === 'date_time')

  const {
    createMutation,
    updateMutation,
    snoozeMutation,
    dismissMutation,
    deleteMutation,
  } = useReminderMutations()

  const [kind, setKind] = useState<ReminderKind>('relative_due')
  const [offsetMinutes, setOffsetMinutes] = useState<number>(15)
  const [customDate, setCustomDate] = useState('')
  const [customTime, setCustomTime] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  const isEditing = Boolean(initialReminder)

  useEffect(() => {
    if (!isOpen) return
    setErrorMsg(null)
    setIsConfirmingDelete(false)

    if (initialReminder) {
      setKind(initialReminder.reminderKind)
      if (initialReminder.reminderKind === 'relative_due') {
        setOffsetMinutes(initialReminder.offsetMinutes ?? 15)
      } else {
        const parsed = fromScheduleInstant(initialReminder.remindAt, timeZone)
        setCustomDate(parsed.dateStr)
        setCustomTime(parsed.timeStr)
      }
    } else {
      if (initialOffsetMinutes !== undefined && initialOffsetMinutes !== null) {
        setKind('relative_due')
        setOffsetMinutes(initialOffsetMinutes)
      } else if (!hasTimedDue) {
        setKind('absolute')
      } else {
        setKind('relative_due')
        setOffsetMinutes(15)
      }

      // Default custom date & time (1 hour from now)
      const future = new Date(Date.now() + 60 * 60 * 1000)
      const parsed = fromScheduleInstant(future.toISOString(), timeZone)
      setCustomDate(parsed.dateStr)
      setCustomTime(parsed.timeStr)
    }
  }, [isOpen, initialReminder, initialOffsetMinutes, hasTimedDue, timeZone])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setErrorMsg(null)

    try {
      if (kind === 'relative_due') {
        if (!hasTimedDue) {
          setErrorMsg('Công việc này chưa có hạn chót có giờ cụ thể.')
          return
        }

        const calculatedRemindAt = resolveRelativeReminderInstant(task.dueAt!, offsetMinutes)
        if (new Date(calculatedRemindAt).getTime() <= Date.now()) {
          setErrorMsg('Thời điểm nhắc nhở tính toán đã ở trong quá khứ. Vui lòng chọn mốc thời gian khác.')
          return
        }

        if (isEditing && initialReminder) {
          await updateMutation.mutateAsync({
            id: initialReminder.id,
            input: {
              reminderKind: 'relative_due',
              offsetMinutes,
              previousUpdatedAt: initialReminder.updatedAt,
            },
          })
        } else {
          await createMutation.mutateAsync({
            taskId: task.id,
            reminderKind: 'relative_due',
            offsetMinutes,
            remindAt: calculatedRemindAt,
          })
        }
      } else {
        // Absolute reminder
        if (!customDate || !customTime) {
          setErrorMsg('Vui lòng chọn ngày và giờ cho lời nhắc.')
          return
        }

        const { instant } = parseScheduleLocalDateTime(customDate, customTime, timeZone)
        if (new Date(instant).getTime() <= Date.now()) {
          setErrorMsg('Thời điểm nhắc nhở phải ở tương lai.')
          return
        }

        if (isEditing && initialReminder) {
          await updateMutation.mutateAsync({
            id: initialReminder.id,
            input: {
              reminderKind: 'absolute',
              offsetMinutes: null,
              remindAt: instant,
              previousUpdatedAt: initialReminder.updatedAt,
            },
          })
        } else {
          await createMutation.mutateAsync({
            taskId: task.id,
            reminderKind: 'absolute',
            remindAt: instant,
          })
        }
      }

      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lưu lời nhắc.')
    }
  }

  const handleSnooze = async (minutes: number) => {
    if (!initialReminder) return
    setErrorMsg(null)
    try {
      const snoozeInstant = resolveSnoozeInstant(new Date(), minutes)
      await snoozeMutation.mutateAsync({
        id: initialReminder.id,
        snoozedUntil: snoozeInstant,
        previousUpdatedAt: initialReminder.updatedAt,
      })
      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi hoãn lời nhắc.')
    }
  }

  const handleDismiss = async () => {
    if (!initialReminder) return
    setErrorMsg(null)
    try {
      await dismissMutation.mutateAsync({
        id: initialReminder.id,
        previousUpdatedAt: initialReminder.updatedAt,
      })
      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi đóng lời nhắc.')
    }
  }

  const handleDelete = async () => {
    if (!initialReminder) return
    setErrorMsg(null)
    try {
      await deleteMutation.mutateAsync({
        id: initialReminder.id,
        previousUpdatedAt: initialReminder.updatedAt,
        taskId: task.id,
      })
      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi xóa lời nhắc.')
    }
  }

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    snoozeMutation.isPending ||
    dismissMutation.isPending ||
    deleteMutation.isPending

  const modalContent = (
    <div className="modal-backdrop" data-testid="reminder-editor-backdrop">
      <div
        className="modal-content reminder-editor-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-editor-title"
        data-testid="reminder-editor-modal"
      >
        <div className="modal-header">
          <h3 id="reminder-editor-title" className="modal-title">
            {isEditing ? 'Chỉnh sửa lời nhắc' : 'Tạo lời nhắc mới'}
          </h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="reminder-editor-form">
          {errorMsg && (
            <div className="form-error-banner" role="alert" data-testid="reminder-editor-error">
              {errorMsg}
            </div>
          )}

          {/* Kind selection */}
          <div className="form-group">
            <label className="form-label">Loại lời nhắc</label>
            <div className="kind-toggle-row">
              <label className="radio-label">
                <input
                  type="radio"
                  name="reminderKind"
                  value="relative_due"
                  checked={kind === 'relative_due'}
                  disabled={!hasTimedDue}
                  onChange={() => setKind('relative_due')}
                  data-testid="kind-relative-radio"
                />
                <span>Theo hạn chót</span>
              </label>

              <label className="radio-label">
                <input
                  type="radio"
                  name="reminderKind"
                  value="absolute"
                  checked={kind === 'absolute'}
                  onChange={() => setKind('absolute')}
                  data-testid="kind-absolute-radio"
                />
                <span>Thời điểm cụ thể (Cố định)</span>
              </label>
            </div>
          </div>

          {kind === 'relative_due' ? (
            <div className="form-group">
              <CustomDropdown
                id="reminder-offset"
                testId="reminder-offset-select"
                label="Nhắc trước bao lâu?"
                value={String(offsetMinutes)}
                options={[
                  { value: '0', label: 'Đúng thời hạn' },
                  { value: '5', label: 'Trước 5 phút' },
                  { value: '15', label: 'Trước 15 phút' },
                  { value: '30', label: 'Trước 30 phút' },
                  { value: '60', label: 'Trước 1 giờ' },
                  { value: '1440', label: 'Trước 1 ngày' },
                ]}
                onChange={(val: string) => setOffsetMinutes(Number(val))}
              />

              {task.dueAt && (
                <div className="calculated-time-preview">
                  Sẽ nhắc vào:{' '}
                  <strong>
                    {formatReminderDisplay(
                      resolveRelativeReminderInstant(task.dueAt, offsetMinutes),
                      timeZone
                    )}
                  </strong>
                </div>
              )}
            </div>
          ) : (
            <div className="form-row">
              <div className="form-group col-6">
                <DatePicker
                  id="reminder-date"
                  testId="reminder-date-input"
                  label="Ngày nhắc"
                  value={customDate}
                  onChange={(newDate: string) => setCustomDate(newDate)}
                  timeZone={timeZone}
                  required
                />
              </div>
              <div className="form-group col-6">
                <TimePicker24h
                  id="reminder-time"
                  testId="reminder-time-input"
                  label="Giờ nhắc (24h)"
                  value={customTime}
                  onChange={(newTime: string) => setCustomTime(newTime)}
                  required
                />
              </div>
            </div>
          )}

          {isEditing && initialReminder && initialReminder.status !== 'dismissed' && (
            <div className="reminder-quick-actions-box">
              <span className="box-sublabel">Thao tác nhanh:</span>
              <div className="quick-actions-buttons">
                {SNOOZE_PRESETS.map((s) => (
                  <button
                    key={s.minutes}
                    type="button"
                    className="btn btn-outline btn-xs"
                    onClick={() => handleSnooze(s.minutes)}
                    disabled={isPending}
                    data-testid={`snooze-btn-${s.minutes}`}
                  >
                    💤 {s.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  onClick={handleDismiss}
                  disabled={isPending}
                  data-testid="dismiss-action-btn"
                >
                  ✓ Đã xong (Bỏ qua)
                </button>
              </div>
            </div>
          )}

          <div className="modal-footer">
            {isEditing && (
              <div className="footer-left">
                {!isConfirmingDelete ? (
                  <button
                    type="button"
                    className="btn btn-danger-ghost"
                    onClick={() => setIsConfirmingDelete(true)}
                    disabled={isPending}
                    data-testid="reminder-delete-btn"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    <span>Xóa lời nhắc</span>
                  </button>
                ) : (
                  <div className="delete-confirm-group">
                    <span className="confirm-text">Xác nhận?</span>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={handleDelete}
                      disabled={isPending}
                      data-testid="reminder-delete-confirm-btn"
                    >
                      Xóa
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setIsConfirmingDelete(false)}
                      disabled={isPending}
                    >
                      Hủy
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="footer-right">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isPending}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isPending}
                data-testid="reminder-save-btn"
              >
                {isPending ? 'Đang lưu...' : isEditing ? 'Cập nhật' : 'Tạo lời nhắc'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent
}
