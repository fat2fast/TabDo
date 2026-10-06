import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  fromScheduleInstant,
  parseScheduleLocalDateTime,
} from '@tabdo/utils'
import { useAuth } from '../../auth/auth-provider'
import { useSchedulableTasks, useTaskDetail } from '../../tasks/hooks/use-tasks'
import type { Task } from '../../tasks/types'
import { useScheduleBlockMutations } from '../hooks/use-schedule-block-mutations'
import type { ScheduleBlock } from '../types'
import { CustomDropdown, type DropdownOption } from '../../../components/ui/custom-dropdown'
import { DatePicker } from '../../../components/ui/date-picker'
import { TimePicker24h } from '../../../components/ui/time-picker-24h'

export interface ScheduleEditorProps {
  isOpen: boolean
  onClose: () => void
  initialBlock?: ScheduleBlock | null
  initialStartAt?: string
  initialEndAt?: string
  initialTask?: Task | null
  onSuccess?: (block: ScheduleBlock) => void
  onDeleted?: (blockId: string) => void
}

export function ScheduleEditor({
  isOpen,
  onClose,
  initialBlock,
  initialStartAt,
  initialEndAt,
  initialTask,
  onSuccess,
  onDeleted,
}: ScheduleEditorProps) {
  const { profile } = useAuth()
  const timeZone = profile?.timezone || 'Asia/Ho_Chi_Minh'

  const { createMutation, updateMutation, deleteMutation } = useScheduleBlockMutations()
  const { data: schedulableTasks = [] } = useSchedulableTasks(100) ?? {}

  // Explicitly fetch task detail for target linked task if block or prop has taskId
  const targetTaskId = initialBlock?.taskId || initialTask?.id
  const { data: directLinkedTask } = useTaskDetail(targetTaskId) ?? {}

  const taskOptions: DropdownOption<string>[] = React.useMemo(() => {
    const list: DropdownOption<string>[] = [
      {
        value: '',
        label: '-- Không liên kết công việc (Lịch độc lập) --',
      },
    ]

    const allCandidateTasks = [...schedulableTasks]
    if (directLinkedTask && !allCandidateTasks.some((t) => t.id === directLinkedTask.id)) {
      allCandidateTasks.unshift(directLinkedTask)
    } else if (initialTask && !allCandidateTasks.some((t) => t.id === initialTask.id)) {
      allCandidateTasks.unshift(initialTask)
    }

    allCandidateTasks.forEach((t) => {
      const isDone = t.status === 'done'
      const label = isDone ? `${t.title} (✓ Đã hoàn thành)` : t.title
      list.push({
        value: t.id,
        label,
        color: isDone ? '#94a3b8' : t.priority === 'high' ? '#ef4444' : t.priority === 'low' ? '#10b981' : undefined,
      })
    })
    return list
  }, [schedulableTasks, directLinkedTask, initialTask])

  // State
  const [title, setTitle] = useState('')
  const [taskId, setTaskId] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  // Initialize or reset form values
  useEffect(() => {
    if (!isOpen) return

    setErrorMsg(null)
    setIsConfirmingDelete(false)

    if (initialBlock) {
      setTitle(initialBlock.title)
      setTaskId(initialBlock.taskId || '')
      const startParsed = fromScheduleInstant(initialBlock.startAt, timeZone)
      const endParsed = fromScheduleInstant(initialBlock.endAt, timeZone)
      setStartDate(startParsed.dateStr)
      setStartTime(startParsed.timeStr)
      setEndDate(endParsed.dateStr)
      setEndTime(endParsed.timeStr)
    } else {
      setTitle(initialTask ? initialTask.title : '')
      setTaskId(initialTask ? initialTask.id : '')

      const startInstant = initialStartAt || new Date().toISOString()
      const startParsed = fromScheduleInstant(startInstant, timeZone)
      setStartDate(startParsed.dateStr)
      setStartTime(startParsed.timeStr || '09:00')

      if (initialEndAt) {
        const endParsed = fromScheduleInstant(initialEndAt, timeZone)
        setEndDate(endParsed.dateStr)
        setEndTime(endParsed.timeStr)
      } else {
        // Default 1 hour later
        setEndDate(startParsed.dateStr)
        const [hours, mins] = (startParsed.timeStr || '09:00').split(':').map(Number)
        const nextHour = (hours + 1) % 24
        setEndTime(`${String(nextHour).padStart(2, '0')}:${String(mins).padStart(2, '0')}`)
      }
    }
  }, [isOpen, initialBlock, initialStartAt, initialEndAt, initialTask, timeZone])

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

  // Find currently selected task for preview badge
  const selectedTask = React.useMemo(() => {
    if (!taskId) return null
    if (directLinkedTask && directLinkedTask.id === taskId) return directLinkedTask
    if (initialTask && initialTask.id === taskId) return initialTask
    return schedulableTasks.find((t) => t.id === taskId) || null
  }, [taskId, directLinkedTask, initialTask, schedulableTasks])

  // Calculated duration string
  const calculatedDuration = React.useMemo(() => {
    if (!startDate || !startTime || !endDate || !endTime) return null
    try {
      const s = parseScheduleLocalDateTime(startDate, startTime, timeZone)
      const e = parseScheduleLocalDateTime(endDate, endTime, timeZone)
      const diffMs = new Date(e.instant).getTime() - new Date(s.instant).getTime()
      if (diffMs <= 0) return null
      const totalMinutes = Math.round(diffMs / 60000)
      if (totalMinutes < 60) return `${totalMinutes} phút`
      const hours = Math.floor(totalMinutes / 60)
      const remainingMins = totalMinutes % 60
      return remainingMins > 0 ? `${hours} giờ ${remainingMins} phút` : `${hours} giờ`
    } catch {
      return null
    }
  }, [startDate, startTime, endDate, endTime, timeZone])

  const handleSetDuration = (durationMinutes: number) => {
    if (!startDate || !startTime) return
    try {
      const startParsed = parseScheduleLocalDateTime(startDate, startTime, timeZone)
      const endInstant = new Date(new Date(startParsed.instant).getTime() + durationMinutes * 60 * 1000)
      const endParsed = fromScheduleInstant(endInstant, timeZone)
      setEndDate(endParsed.dateStr)
      setEndTime(endParsed.timeStr)
    } catch {
      // ignore
    }
  }

  if (!isOpen) return null

  const isEditing = Boolean(initialBlock)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setErrorMsg(null)

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setErrorMsg('Vui lòng nhập tiêu đề cho lịch trình.')
      return
    }
    if (trimmedTitle.length > 500) {
      setErrorMsg('Tiêu đề không được vượt quá 500 ký tự.')
      return
    }

    if (!startDate || !startTime || !endDate || !endTime) {
      setErrorMsg('Vui lòng chọn đầy đủ thời gian bắt đầu và kết thúc.')
      return
    }

    try {
      const parsedStart = parseScheduleLocalDateTime(startDate, startTime, timeZone)
      const parsedEnd = parseScheduleLocalDateTime(endDate, endTime, timeZone)

      if (new Date(parsedEnd.instant).getTime() <= new Date(parsedStart.instant).getTime()) {
        setErrorMsg('Thời gian kết thúc phải diễn ra sau thời gian bắt đầu.')
        return
      }

      if (isEditing && initialBlock) {
        const updated = await updateMutation.mutateAsync({
          id: initialBlock.id,
          input: {
            title: trimmedTitle,
            taskId: taskId || null,
            startAt: parsedStart.instant,
            endAt: parsedEnd.instant,
            previousUpdatedAt: initialBlock.updatedAt,
          },
        })
        onSuccess?.(updated)
      } else {
        const created = await createMutation.mutateAsync({
          title: trimmedTitle,
          taskId: taskId || null,
          startAt: parsedStart.instant,
          endAt: parsedEnd.instant,
        })
        onSuccess?.(created)
      }
      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'Đã có lỗi xảy ra khi lưu lịch trình.')
    }
  }

  const handleDelete = async () => {
    if (!initialBlock) return
    try {
      await deleteMutation.mutateAsync({
        id: initialBlock.id,
        previousUpdatedAt: initialBlock.updatedAt,
      })
      onDeleted?.(initialBlock.id)
      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'Đã có lỗi xảy ra khi xóa lịch trình.')
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  const modalContent = (
    <div className="modal-backdrop" onClick={onClose} data-testid="schedule-editor-backdrop">
      <div
        className="modal-content schedule-editor-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-editor-title"
        data-testid="schedule-editor-modal"
      >
        <div className="modal-header">
          <h3 id="schedule-editor-title" className="modal-title">
            {isEditing ? 'Chỉnh sửa lịch trình' : 'Lên lịch làm việc'}
          </h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="schedule-editor-form">
          {errorMsg && (
            <div className="form-error-banner" role="alert" data-testid="schedule-editor-error">
              {errorMsg}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="schedule-title" className="form-label">
              Tiêu đề <span className="required">*</span>
            </label>
            <input
              id="schedule-title"
              type="text"
              className="form-input"
              placeholder="Ví dụ: Tập trung code API, Xem tài liệu..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={500}
              autoFocus
              data-testid="schedule-title-input"
            />
          </div>

          <div className="form-group">
            <CustomDropdown
              id="schedule-task"
              testId="schedule-task-select"
              label="Liên kết công việc (Tùy chọn)"
              value={taskId}
              options={taskOptions}
              onChange={(selectedId: string) => {
                setTaskId(selectedId)
                if (selectedId && (!title || title.trim() === '')) {
                  const foundTask =
                    (directLinkedTask?.id === selectedId ? directLinkedTask : null) ||
                    (initialTask?.id === selectedId ? initialTask : null) ||
                    schedulableTasks.find((t) => t.id === selectedId)
                  if (foundTask) {
                    setTitle(foundTask.title)
                  }
                }
              }}
              placeholder="-- Không liên kết công việc (Lịch độc lập) --"
            />

            {selectedTask && (
              <div
                className="linked-task-status-pill"
                data-testid="linked-task-status-pill"
                style={{
                  marginTop: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: selectedTask.status === 'done' ? '#f8fafc' : '#f0fdf4',
                  border: `1px solid ${selectedTask.status === 'done' ? '#e2e8f0' : '#bbf7d0'}`,
                  fontSize: '12px',
                }}
              >
                <span style={{ fontSize: '13px' }}>🔗</span>
                <span style={{ color: '#64748b' }}>Công việc:</span>
                <span
                  style={{
                    fontWeight: 600,
                    color: selectedTask.status === 'done' ? '#64748b' : '#0f172a',
                    textDecoration: selectedTask.status === 'done' ? 'line-through' : 'none',
                  }}
                >
                  {selectedTask.title}
                </span>
                {selectedTask.status === 'done' ? (
                  <span
                    style={{
                      marginLeft: 'auto',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      background: '#dcfce7',
                      color: '#15803d',
                      fontWeight: 600,
                    }}
                  >
                    ✓ Đã hoàn thành
                  </span>
                ) : (
                  <span
                    style={{
                      marginLeft: 'auto',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      background: '#e0f2fe',
                      color: '#0284c7',
                      fontWeight: 600,
                    }}
                  >
                    Đang thực hiện
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group col-6">
              <DatePicker
                id="schedule-start-date"
                testId="schedule-start-date"
                label="Ngày bắt đầu"
                value={startDate}
                onChange={(newStartDate: string) => {
                  setStartDate(newStartDate)
                  if (endDate && newStartDate > endDate) {
                    setEndDate(newStartDate)
                  }
                }}
                timeZone={timeZone}
                required
              />
            </div>
            <div className="form-group col-6">
              <TimePicker24h
                id="schedule-start-time"
                testId="schedule-start-time"
                label="Giờ bắt đầu (24h)"
                value={startTime}
                onChange={(newStartTime: string) => setStartTime(newStartTime)}
                required
              />
            </div>
          </div>

          {/* Quick Duration Buttons */}
          <div className="quick-duration-wrapper">
            <span className="quick-duration-label">Thời lượng nhanh:</span>
            <div className="quick-duration-chips">
              {[
                { label: '+15p', minutes: 15 },
                { label: '+30p', minutes: 30 },
                { label: '+45p', minutes: 45 },
                { label: '+1h', minutes: 60 },
                { label: '+2h', minutes: 120 },
              ].map(({ label, minutes }) => (
                <button
                  key={minutes}
                  type="button"
                  className="quick-duration-btn"
                  onClick={() => handleSetDuration(minutes)}
                  title={`Đặt thời lượng ${minutes} phút`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group col-6">
              <DatePicker
                id="schedule-end-date"
                testId="schedule-end-date"
                label="Ngày kết thúc"
                value={endDate}
                onChange={(newEndDate: string) => setEndDate(newEndDate)}
                timeZone={timeZone}
                required
              />
            </div>
            <div className="form-group col-6">
              <div className="label-with-duration">
                <span className="duration-label-text">Giờ kết thúc (24h)</span>
                {calculatedDuration && (
                  <span className="duration-pill" title="Thời lượng phiên làm việc">
                    ⏱️ {calculatedDuration}
                  </span>
                )}
              </div>
              <TimePicker24h
                id="schedule-end-time"
                testId="schedule-end-time"
                value={endTime}
                onChange={(newEndTime: string) => setEndTime(newEndTime)}
                required
              />
            </div>
          </div>

          <div className="timezone-hint">
            <span>Múi giờ áp dụng: </span>
            <strong>{timeZone}</strong>
          </div>

          <div className="modal-footer">
            {isEditing && (
              <div className="footer-left">
                {!isConfirmingDelete ? (
                  <button
                    type="button"
                    className="btn btn-danger-ghost"
                    onClick={() => setIsConfirmingDelete(true)}
                    disabled={isSubmitting}
                    data-testid="schedule-delete-btn"
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
                    <span>Xóa lịch</span>
                  </button>
                ) : (
                  <div className="delete-confirm-group">
                    <span className="confirm-text">Xác nhận xóa?</span>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={handleDelete}
                      disabled={isSubmitting}
                      data-testid="schedule-delete-confirm-btn"
                    >
                      Xóa
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setIsConfirmingDelete(false)}
                      disabled={isSubmitting}
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
                disabled={isSubmitting}
              >
                Đóng
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
                data-testid="schedule-save-btn"
              >
                {isSubmitting ? 'Đang lưu...' : isEditing ? 'Cập nhật' : 'Tạo lịch trình'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent
}
