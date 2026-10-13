import React, { useEffect, useState } from 'react'
import {
  fromScheduleInstant,
  isScheduleBlockAllDay,
} from '@tabdo/utils'
import { useAuth } from '../../auth/auth-provider'
import { useTaskDetail } from '../../tasks/hooks/use-tasks'
import { useTaskMutations } from '../../tasks/hooks/use-task-mutations'
import { useScheduleBlockMutations } from '../hooks/use-schedule-block-mutations'
import type { ScheduleBlock } from '../types'
import { useConfirm } from '../../../components/ui/confirm-dialog'

export interface ScheduleDetailModalProps {
  isOpen: boolean
  block: ScheduleBlock | null
  onClose: () => void
  onEdit: (block: ScheduleBlock) => void
  onDeleted?: (blockId: string) => void
  onOpenTaskDetail?: (taskId: string) => void
}

export function ScheduleDetailModal({
  isOpen,
  block,
  onClose,
  onEdit,
  onDeleted,
  onOpenTaskDetail,
}: ScheduleDetailModalProps) {
  const { profile } = useAuth()
  const timeZone = profile?.timezone || 'Asia/Ho_Chi_Minh'
  const confirm = useConfirm()

  const { deleteMutation } = useScheduleBlockMutations()
  const { completeTaskMutation } = useTaskMutations()

  const { data: linkedTask } = useTaskDetail(block?.taskId || null) ?? {}
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    setActionError(null)
  }, [isOpen, block])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !block) return null

  const isAllDay = isScheduleBlockAllDay(block.startAt, block.endAt, timeZone)
  const startParsed = fromScheduleInstant(block.startAt, timeZone)
  const endParsed = fromScheduleInstant(block.endAt, timeZone)

  // Calculate duration if not all day
  const durationText = (() => {
    if (isAllDay) return null
    try {
      const diffMs = new Date(block.endAt).getTime() - new Date(block.startAt).getTime()
      if (diffMs <= 0) return null
      const totalMinutes = Math.round(diffMs / 60000)
      if (totalMinutes < 60) return `${totalMinutes} phút`
      const hours = Math.floor(totalMinutes / 60)
      const remainingMins = totalMinutes % 60
      return remainingMins > 0 ? `${hours} giờ ${remainingMins} phút` : `${hours} giờ`
    } catch {
      return null
    }
  })()

  // Format date presentation
  const formatDateDisplay = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number)
      const dateObj = new Date(y, m - 1, d)
      const daysOfWeek = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
      const dayName = daysOfWeek[dateObj.getDay()]
      return `${dayName}, ${d} thg ${m}, ${y}`
    } catch {
      return dateStr
    }
  }

  const handleDelete = async () => {
    const isConfirmed = await confirm({
      title: 'Xóa lịch trình',
      message: `Bạn có chắc chắn muốn xóa lịch trình "${block.title}" không? Hành động này không thể hoàn tác.`,
      confirmText: 'Xóa lịch',
      cancelText: 'Hủy',
      variant: 'danger',
    })

    if (!isConfirmed) return

    try {
      await deleteMutation.mutateAsync({
        id: block.id,
        previousUpdatedAt: block.updatedAt,
      })
      onDeleted?.(block.id)
      onClose()
    } catch (err: any) {
      setActionError(err.message || 'Không thể xóa lịch trình.')
    }
  }

  const handleCompleteTask = async () => {
    if (!linkedTask) return
    try {
      await completeTaskMutation.mutateAsync(linkedTask)
      onClose()
    } catch (err: any) {
      setActionError(err.message || 'Không thể hoàn thành công việc.')
    }
  }

  return (
    <div className="modal-backdrop" data-testid="schedule-detail-backdrop">
      <div
        className="modal-content schedule-detail-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-detail-title"
        data-testid="schedule-detail-modal"
      >
        {/* Top Action Bar */}
        <div className="schedule-detail-header">
          <div className="schedule-detail-header-left">
            <span
              className={`schedule-detail-dot ${block.taskId ? 'has-task' : 'independent'}`}
            />
            <span className="schedule-detail-badge">
              {isAllDay ? 'Cả ngày' : 'Lịch trình'}
            </span>
          </div>

          <div className="schedule-detail-actions">
            <button
              type="button"
              className="schedule-action-icon-btn"
              onClick={() => onEdit(block)}
              title="Chỉnh sửa lịch trình"
              aria-label="Chỉnh sửa"
              data-testid="schedule-detail-edit-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>

            <button
              type="button"
              className="schedule-action-icon-btn delete-btn"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              title="Xóa lịch trình"
              aria-label="Xóa"
              data-testid="schedule-detail-delete-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>

            <button
              type="button"
              className="schedule-action-icon-btn close-btn"
              onClick={onClose}
              title="Đóng"
              aria-label="Đóng"
              data-testid="schedule-detail-close-btn"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Error banner */}
        {actionError && (
          <div className="form-error-banner" role="alert">
            {actionError}
          </div>
        )}

        {/* Body: Info List format */}
        <div className="schedule-detail-body">
          <h2 id="schedule-detail-title" className="schedule-detail-title">
            {block.title}
          </h2>

          <div className="schedule-info-list">
            {/* Row 1: Date & Time */}
            <div className="schedule-info-item">
              <div className="schedule-info-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div className="schedule-info-content">
                <div className="schedule-info-primary">
                  {formatDateDisplay(startParsed.dateStr)}
                  {startParsed.dateStr !== endParsed.dateStr && (
                    <span> - {formatDateDisplay(endParsed.dateStr)}</span>
                  )}
                </div>
                <div className="schedule-info-secondary">
                  {isAllDay ? (
                    <span className="all-day-pill">Cả ngày</span>
                  ) : (
                    <span>
                      {startParsed.timeStr} – {endParsed.timeStr}
                      {durationText && <span className="duration-subtext"> ({durationText})</span>}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Linked Task */}
            <div className="schedule-info-item">
              <div className="schedule-info-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                </svg>
              </div>
              <div className="schedule-info-content">
                {linkedTask ? (
                  <div className="linked-task-detail-block">
                    <button
                      type="button"
                      className="linked-task-clickable-name"
                      onClick={() => onOpenTaskDetail?.(linkedTask.id)}
                      title="Mở chi tiết công việc"
                      data-testid="schedule-detail-open-task-btn"
                    >
                      <span className="linked-task-title-text">{linkedTask.title}</span>
                      <span className="linked-task-jump-icon">↗</span>
                    </button>
                    <div className="linked-task-meta-row">
                      <span className={`task-status-pill status-${linkedTask.status}`}>
                        {linkedTask.status === 'done'
                          ? '✓ Đã hoàn thành'
                          : linkedTask.status === 'in_progress'
                            ? 'Đang làm'
                            : 'Cần làm'}
                      </span>
                      {linkedTask.priority && (
                        <span className={`task-priority-pill priority-${linkedTask.priority}`}>
                          {linkedTask.priority === 'high'
                            ? 'Cao'
                            : linkedTask.priority === 'low'
                              ? 'Thấp'
                              : 'Trung bình'}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="independent-schedule-text">
                    Lịch độc lập (Không liên kết công việc)
                  </div>
                )}
              </div>
            </div>

            {/* Row 3: Timezone */}
            <div className="schedule-info-item timezone-item">
              <div className="schedule-info-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <div className="schedule-info-content">
                <div className="schedule-info-secondary">
                  Múi giờ: <strong>{timeZone}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="schedule-detail-footer">
          {linkedTask && linkedTask.status !== 'done' ? (
            <button
              type="button"
              className="btn btn-primary schedule-complete-btn"
              onClick={handleCompleteTask}
              disabled={completeTaskMutation.isPending}
              data-testid="schedule-detail-mark-complete-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{completeTaskMutation.isPending ? 'Đang hoàn thành...' : 'Đánh dấu hoàn thành'}</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Đóng
            </button>
          )}

          <button
            type="button"
            className="btn btn-ghost-sm"
            onClick={() => onEdit(block)}
          >
            Chỉnh sửa
          </button>
        </div>
      </div>
    </div>
  )
}
