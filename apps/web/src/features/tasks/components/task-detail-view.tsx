import React, { useMemo, useState } from 'react'
import {
  formatDisplayDate,
  formatRecurrenceRuleSummary,
  formatReminderDisplay,
  formatTaskCompletedAt,
  formatTaskDueDate,
  formatTaskExecutionDuration,
  formatTaskOverdueDuration,
  isTaskOverdue,
} from '@tabdo/utils'
import { useOptionalAuth } from '../../auth/auth-provider'
import { useCategories } from '../hooks/use-categories'
import { useTaskMutations } from '../hooks/use-task-mutations'
import { useLinkedTasks, useSubtasks, useTaskDetail } from '../hooks/use-tasks'
import type { Task } from '../types'
import {
  extractTaskAttachments,
  formatFileSize,
} from '../utils/task-attachments'
import {
  embedTaskChecklist,
  extractTaskChecklist,
} from '../utils/task-checklist'
import { getCleanTaskDescription } from '../utils/task-description'
import { extractLinkedTaskIds } from '../utils/task-linking'
import { MarkdownViewer } from './ui/markdown-viewer'
import { useScheduleBlocksByTask } from '../../scheduling/hooks/use-schedule-blocks'
import { useRemindersByTask } from '../../reminders/hooks/use-reminders'
import { useConfirm } from '../../../components/ui'

export interface TaskDetailViewProps {
  task: Task
  onEdit: () => void
  onClose: () => void
  onDeleted?: () => void
  onNavigateParent?: (parentId: string) => void
}

export function TaskDetailView({
  task,
  onEdit,
  onClose,
  onDeleted,
  onNavigateParent,
}: TaskDetailViewProps) {
  const auth = useOptionalAuth()
  const timeZone = auth?.profile?.timezone || 'Asia/Ho_Chi_Minh'
  const { data: categories = [] } = useCategories()
  const {
    completeTaskMutation,
    reopenTaskMutation,
    deleteTaskMutation,
    updateTaskMutation,
  } = useTaskMutations()
  const confirm = useConfirm()

  const isCompleted = task.status === 'done'
  const isOverdue = isTaskOverdue(task.dueAt, task.status, new Date())
  const category = categories.find((c) => c.id === task.categoryId)

  const { data: parentTask } = useTaskDetail(task.parentId)
  const { data: subtasks = [] } = useSubtasks(task.parentId ? null : task.id)
  const { data: scheduleBlocks = [] } = useScheduleBlocksByTask(task.id)
  const { data: taskReminders = [] } = useRemindersByTask(task.id)

  const [activeTab, setActiveTab] = useState<'checklist' | 'schedule' | 'reminders' | 'subtasks' | 'attachments' | 'related'>('checklist')

  const cleanDescription = useMemo(
    () => getCleanTaskDescription(task.description),
    [task.description]
  )
  const checklistItems = useMemo(
    () => extractTaskChecklist(task.description),
    [task.description]
  )
  const attachments = useMemo(
    () => extractTaskAttachments(task.description),
    [task.description]
  )
  const linkedTaskIds = useMemo(
    () => extractLinkedTaskIds(task.description),
    [task.description]
  )
  const { data: linkedTasks = [] } = useLinkedTasks(linkedTaskIds)

  // Status mapping
  const statusLabel =
    task.status === 'done'
      ? 'Đã hoàn thành'
      : task.status === 'in_progress'
      ? 'Đang thực hiện'
      : 'Cần làm'

  // Priority mapping
  const priorityLabel =
    task.priority === 'high'
      ? 'Ưu tiên cao'
      : task.priority === 'medium'
      ? 'Trung bình'
      : 'Ưu tiên thấp'

  // Toggle complete / reopen
  const handleToggleComplete = async () => {
    if (isCompleted) {
      try {
        await reopenTaskMutation.mutateAsync(task)
      } catch (err: any) {
        confirm({
          title: 'Không thể mở lại công việc',
          message:
            err?.message ||
            'Không thể mở lại công việc lặp lại đã có phiên lặp tiếp theo.',
          confirmText: 'Đã hiểu',
          cancelText: null,
          variant: 'warning',
        })
      }
    } else {
      await completeTaskMutation.mutateAsync(task)
    }
  }

  // Toggle checklist item status in read mode
  const handleToggleChecklistItem = async (itemIndex: number) => {
    if (isCompleted) return
    const updatedItems = checklistItems.map((item, idx) =>
      idx === itemIndex ? { ...item, completed: !item.completed } : item
    )

    let fullDesc = cleanDescription
    fullDesc = embedTaskChecklist(fullDesc, updatedItems)
    const { embedLinkedTaskIds } = await import('../utils/task-linking')
    const { embedTaskAttachments } = await import('../utils/task-attachments')
    fullDesc = embedLinkedTaskIds(fullDesc, linkedTaskIds)
    fullDesc = embedTaskAttachments(fullDesc, attachments)

    await updateTaskMutation.mutateAsync({
      id: task.id,
      input: { description: fullDesc },
      previousTask: task,
    })
  }

  // Delete task
  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Xóa công việc?',
      message: (
        <span>
          Bạn có chắc chắn muốn xóa công việc <strong>"{task.title}"</strong>? Các công việc con và tài liệu đính kèm liên quan cũng sẽ bị xóa vĩnh viễn.
        </span>
      ),
      confirmText: 'Xóa công việc',
      cancelText: 'Hủy',
      variant: 'danger',
    })
    if (!confirmed) return

    try {
      await deleteTaskMutation.mutateAsync({ id: task.id, parentId: task.parentId })
      if (onDeleted) {
        onDeleted()
      } else {
        onClose()
      }
    } catch {
      // Handled by query mutation
    }
  }

  const completedChecklistCount = checklistItems.filter((i) => i.completed).length

  return (
    <div className="task-detail-view-container modern-2col-layout" data-testid="task-detail-view">
      {/* =========================================================================
          LEFT MAIN WORKSPACE COLUMN (Header, Markdown prose, Vertical Tabs)
          ========================================================================= */}
      <div className="task-detail-main-col">
        {/* Completed Status Banner */}
        {isCompleted && (
          <div className="task-completed-locked-banner" role="status" data-testid="task-completed-locked-banner">
            <div className="banner-status-info">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="banner-check-icon"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <div className="banner-text-details">
                <span className="banner-status-heading">Công việc đã hoàn thành</span>
                <span className="banner-status-sub">
                  {task.completedAt
                    ? `Hoàn thành lúc: ${formatTaskCompletedAt(task.completedAt, timeZone)} (Chế độ chỉ xem)`
                    : 'Công việc đang ở trạng thái hoàn thành (Chế độ chỉ xem)'}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm banner-reopen-btn"
              onClick={handleToggleComplete}
              disabled={reopenTaskMutation.isPending}
              title="Mở lại công việc để tiếp tục chỉnh sửa"
            >
              {reopenTaskMutation.isPending ? 'Đang mở lại...' : '↺ Mở lại công việc'}
            </button>
          </div>
        )}

        {/* Subtask Breadcrumb Banner */}
        {task.parentId && (
          <div className="subtask-parent-banner" data-testid="subtask-parent-banner">
            <div className="banner-left">
              <span className="subtask-branch-icon">↳</span>
              <span className="banner-tag">Công việc con</span>
              {parentTask && (
                <span className="banner-parent-info">
                  thuộc: <strong>{parentTask.title}</strong>
                </span>
              )}
            </div>
            {onNavigateParent && (
              <button
                type="button"
                className="banner-nav-btn"
                onClick={() => onNavigateParent(task.parentId!)}
                title="Chuyển đến công việc cha"
              >
                Xem việc cha &rarr;
              </button>
            )}
          </div>
        )}

        {/* Title Heading View (Not an input field) */}
        <div className="task-detail-title-view-wrap">
          <button
            type="button"
            className={`detail-view-status-checkbox ${isCompleted ? 'checked' : ''}`}
            onClick={handleToggleComplete}
            disabled={completeTaskMutation.isPending || reopenTaskMutation.isPending}
            title={isCompleted ? 'Mở lại công việc' : 'Đánh dấu hoàn thành'}
            aria-label={isCompleted ? 'Mở lại công việc' : 'Đánh dấu hoàn thành'}
          >
            {isCompleted && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
          <h2
            className={`task-detail-heading ${isCompleted ? 'completed-heading' : ''}`}
            data-testid="detail-view-title"
          >
            {task.title}
          </h2>
        </div>

        {/* Description Prose Content (Not an active editor) */}
        <div className="task-detail-desc-box">
          <div className="desc-box-header">
            <span className="desc-box-label">Mô tả / Ghi chú chi tiết</span>
          </div>
          <div className="desc-box-body">
            <MarkdownViewer content={cleanDescription} />
          </div>
        </div>

        {/* Vertical Tabs Layout: Avoids horizontal scrollbar completely */}
        <div className="workspace-tabs-vertical-layout">
          {/* Vertical Navigation Bar */}
          <div className="vertical-tabs-nav" role="tablist" aria-orientation="vertical">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'checklist'}
              className={`vertical-tab-btn ${activeTab === 'checklist' ? 'active' : ''}`}
              onClick={() => setActiveTab('checklist')}
            >
              <span className="tab-btn-icon">☑</span>
              <span className="tab-btn-label">Checklist</span>
              {checklistItems.length > 0 && (
                <span className="tab-btn-badge">{checklistItems.length}</span>
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'schedule'}
              className={`vertical-tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
              onClick={() => setActiveTab('schedule')}
            >
              <span className="tab-btn-icon">📅</span>
              <span className="tab-btn-label">Lịch làm việc</span>
              {scheduleBlocks.length > 0 && (
                <span className="tab-btn-badge">{scheduleBlocks.length}</span>
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'reminders'}
              className={`vertical-tab-btn ${activeTab === 'reminders' ? 'active' : ''}`}
              onClick={() => setActiveTab('reminders')}
            >
              <span className="tab-btn-icon">⏰</span>
              <span className="tab-btn-label">Lời nhắc</span>
              {taskReminders.length > 0 && (
                <span className="tab-btn-badge">{taskReminders.length}</span>
              )}
            </button>

            {!task.parentId && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'subtasks'}
                className={`vertical-tab-btn ${activeTab === 'subtasks' ? 'active' : ''}`}
                onClick={() => setActiveTab('subtasks')}
              >
                <span className="tab-btn-icon">↳</span>
                <span className="tab-btn-label">Việc con</span>
                {subtasks.length > 0 && (
                  <span className="tab-btn-badge">{subtasks.length}</span>
                )}
              </button>
            )}

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'attachments'}
              className={`vertical-tab-btn ${activeTab === 'attachments' ? 'active' : ''}`}
              onClick={() => setActiveTab('attachments')}
            >
              <span className="tab-btn-icon">📎</span>
              <span className="tab-btn-label">Đính kèm</span>
              {attachments.length > 0 && (
                <span className="tab-btn-badge">{attachments.length}</span>
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-label="Liên quan / Liên kết"
              aria-selected={activeTab === 'related'}
              className={`vertical-tab-btn ${activeTab === 'related' ? 'active' : ''}`}
              onClick={() => setActiveTab('related')}
            >
              <span className="tab-btn-icon">🔗</span>
              <span className="tab-btn-label">Liên kết</span>
              {linkedTaskIds.length > 0 && (
                <span className="tab-btn-badge">{linkedTaskIds.length}</span>
              )}
            </button>
          </div>

          {/* Read Mode Content Panel */}
          <div className="vertical-tabs-panel">
            {/* 1. Checklist in Read Mode */}
            {activeTab === 'checklist' && (
              <div className="readmode-tab-content">
                <div className="readmode-header-row">
                  <span className="readmode-title">Checklist công việc</span>
                  {checklistItems.length > 0 && (
                    <span className="readmode-progress-badge">
                      {completedChecklistCount}/{checklistItems.length} hoàn thành
                    </span>
                  )}
                </div>

                {checklistItems.length === 0 ? (
                  <div className="tab-empty-state">
                    <div className="empty-icon-circle">☑</div>
                    <div className="empty-state-title">Chưa có mục checklist nào</div>
                    <p className="empty-state-desc">
                      Công việc này chưa có danh sách checklist chia nhỏ tiến độ.
                    </p>
                  </div>
                ) : (
                  <div className="readmode-checklist-list">
                    {checklistItems.map((item, idx) => (
                      <div
                        key={idx}
                        className={`readmode-checklist-item ${item.completed ? 'is-done' : ''}`}
                        onClick={() => handleToggleChecklistItem(idx)}
                        style={{ cursor: isCompleted ? 'default' : 'pointer' }}
                        title={isCompleted ? undefined : 'Bấm để đánh dấu hoàn thành mục này'}
                      >
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => handleToggleChecklistItem(idx)}
                          disabled={isCompleted}
                          className="readmode-checkbox"
                        />
                        <span className={`readmode-item-text ${item.completed ? 'line-through' : ''}`}>
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. Schedule in Read Mode */}
            {activeTab === 'schedule' && (
              <div className="readmode-tab-content" data-testid="task-scheduled-sessions-section">
                <div className="readmode-header-row">
                  <span className="readmode-title">Lịch làm việc đã xếp ({scheduleBlocks.length})</span>
                </div>

                {scheduleBlocks.length === 0 ? (
                  <div className="tab-empty-state">
                    <div className="empty-icon-circle">📅</div>
                    <div className="empty-state-title">Chưa có lịch làm việc cụ thể</div>
                    <p className="empty-state-desc">
                      Chưa có phiên làm việc nào được ấn định trên Calendar cho công việc này.
                    </p>
                  </div>
                ) : (
                  <div className="scheduled-blocks-grid">
                    {scheduleBlocks.map((block) => (
                      <div key={block.id} className="readmode-schedule-card">
                        <div className="schedule-card-top">
                          <span className="schedule-dot" />
                          <span className="schedule-block-title">{block.title}</span>
                        </div>
                        <div className="schedule-card-time">
                          🕒 {formatDisplayDate(new Date(block.startAt), timeZone, 'HH:mm dd/MM')} &rarr;{' '}
                          {formatDisplayDate(new Date(block.endAt), timeZone, 'HH:mm dd/MM/yyyy')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. Reminders in Read Mode */}
            {activeTab === 'reminders' && (
              <div className="readmode-tab-content">
                <div className="readmode-header-row">
                  <span className="readmode-title">Lời nhắc đã cài đặt ({taskReminders.length})</span>
                </div>

                {taskReminders.length === 0 ? (
                  <div className="tab-empty-state">
                    <div className="empty-icon-circle">⏰</div>
                    <div className="empty-state-title">Chưa có lời nhắc nào</div>
                    <p className="empty-state-desc">
                      Công việc này chưa được cài đặt chuông thông báo nhắc nhở.
                    </p>
                  </div>
                ) : (
                  <div className="readmode-reminders-list">
                    {taskReminders.map((rem) => (
                      <div key={rem.id} className="readmode-reminder-card">
                        <span className="rem-bell-icon">🔔</span>
                        <div className="rem-info">
                          <span className="rem-time">
                            {formatReminderDisplay(rem.remindAt, timeZone)}
                          </span>
                          <span className={`rem-status-badge ${rem.status}`}>
                            {rem.status === 'dismissed'
                              ? 'Đã tắt'
                              : rem.status === 'triggered'
                              ? 'Đã thông báo'
                              : rem.status === 'snoozed'
                              ? 'Tạm hoãn'
                              : 'Đang chờ'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 4. Subtasks in Read Mode */}
            {activeTab === 'subtasks' && !task.parentId && (
              <div className="readmode-tab-content">
                <div className="readmode-header-row">
                  <span className="readmode-title">Danh sách việc con ({subtasks.length})</span>
                </div>

                {subtasks.length === 0 ? (
                  <div className="tab-empty-state">
                    <div className="empty-icon-circle">↳</div>
                    <div className="empty-state-title">Chưa có việc con nào</div>
                    <p className="empty-state-desc">
                      Công việc này không chứa các đầu việc con phụ thuộc.
                    </p>
                  </div>
                ) : (
                  <div className="readmode-subtasks-list">
                    {subtasks.map((st) => (
                      <div key={st.id} className="readmode-subtask-card">
                        <span className="subtask-arrow">↳</span>
                        <span className={`subtask-title ${st.status === 'done' ? 'line-through' : ''}`}>
                          {st.title}
                        </span>
                        <span className={`status-pill-badge status-${st.status}`}>
                          {st.status === 'done' ? '✓ Đã xong' : st.status === 'in_progress' ? 'Đang làm' : 'Cần làm'}
                        </span>
                        {onNavigateParent && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs readmode-nav-btn"
                            onClick={() => onNavigateParent(st.id)}
                            title="Xem chi tiết việc con này"
                          >
                            Mở xem &rarr;
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 5. Attachments in Read Mode */}
            {activeTab === 'attachments' && (
              <div className="readmode-tab-content">
                <div className="readmode-header-row">
                  <span className="readmode-title">Tài liệu đính kèm ({attachments.length})</span>
                </div>

                {attachments.length === 0 ? (
                  <div className="tab-empty-state">
                    <div className="empty-icon-circle">📎</div>
                    <div className="empty-state-title">Chưa có tệp đính kèm</div>
                    <p className="empty-state-desc">
                      Chưa có tài liệu hay đường dẫn liên kết đính kèm nào được tải lên.
                    </p>
                  </div>
                ) : (
                  <div className="readmode-attachments-list">
                    {attachments.map((att) => (
                      <div key={att.id} className="readmode-attachment-card">
                        <span className="att-icon">📎</span>
                        <div className="att-details">
                          <span className="att-name">{att.name}</span>
                          {att.size && <span className="att-size">{formatFileSize(att.size)}</span>}
                        </div>
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-xs"
                          download={att.name}
                        >
                          Tải về / Mở ↗
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 6. Related Tasks in Read Mode */}
            {activeTab === 'related' && (
              <div className="readmode-tab-content">
                <div className="readmode-header-row">
                  <span className="readmode-title">Công việc liên quan ({linkedTasks.length})</span>
                </div>

                {linkedTasks.length === 0 ? (
                  <div className="tab-empty-state">
                    <div className="empty-icon-circle">🔗</div>
                    <div className="empty-state-title">Chưa có công việc liên quan</div>
                    <p className="empty-state-desc">
                      Chưa có công việc nào khác được ghim liên kết với công việc này.
                    </p>
                  </div>
                ) : (
                  <div className="readmode-linked-list">
                    {linkedTasks.map((lt) => (
                      <div key={lt.id} className="readmode-linked-card">
                        <span className="linked-icon">🔗</span>
                        <span className="linked-title">{lt.title}</span>
                        <span className={`status-pill-badge status-${lt.status}`}>
                          {lt.status === 'done' ? '✓ Đã xong' : lt.status === 'in_progress' ? 'Đang làm' : 'Cần làm'}
                        </span>
                        {onNavigateParent && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => onNavigateParent(lt.id)}
                          >
                            Mở xem &rarr;
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          RIGHT SIDEBAR COLUMN: STRUCTURED INFO LIST FORMAT
          ========================================================================= */}
      <div className="task-detail-sidebar-col">
        {/* Info Card 1: Core Properties */}
        <div className="sidebar-properties-box task-info-card" data-testid="detail-info-card-properties">
          <div className="sidebar-box-header">
            <span className="sidebar-header-icon">⚙️</span>
            <span className="sidebar-box-title">Thuộc tính công việc</span>
          </div>

          <div className="task-info-list">
            {/* Status */}
            <div className="task-info-row">
              <span className="task-info-label">Trạng thái</span>
              <span className="task-info-value">
                <span className={`status-pill-badge status-${task.status}`}>
                  {task.status === 'done' && '✓ '}
                  {statusLabel}
                </span>
              </span>
            </div>

            {/* Priority */}
            <div className="task-info-row">
              <span className="task-info-label">Mức độ ưu tiên</span>
              <span className="task-info-value">
                <span className={`priority-pill-badge priority-${task.priority}`}>
                  <span className={`priority-dot ${task.priority}`} />
                  {priorityLabel}
                </span>
              </span>
            </div>

            {/* Category */}
            <div className="task-info-row">
              <span className="task-info-label">Danh mục</span>
              <span className="task-info-value">
                {category ? (
                  <span
                    className="category-badge-chip"
                    style={{ borderColor: category.color || '#0284c7' }}
                  >
                    {category.icon && <span className="cat-icon">{category.icon}</span>}
                    <span>{category.name}</span>
                  </span>
                ) : (
                  <span className="info-empty-val">Không phân loại</span>
                )}
              </span>
            </div>

            {/* Source URL */}
            <div className="task-info-row">
              <span className="task-info-label">URL nguồn</span>
              <span className="task-info-value">
                {task.sourceUrl ? (
                  <a
                    href={task.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="info-link-val"
                    title={task.sourceUrl}
                  >
                    🔗 Mở liên kết ↗
                  </a>
                ) : (
                  <span className="info-empty-val">—</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Info Card 2: Timeline & Recurrence */}
        <div className="sidebar-properties-box sidebar-summary-card task-info-card" data-testid="detail-info-card-timeline">
          <div className="sidebar-box-header">
            <span className="sidebar-header-icon">⏱️</span>
            <span className="sidebar-box-title">Thời gian & Lập lịch</span>
          </div>

          <div className="task-info-list">
            {/* Due date */}
            <div className="task-info-row">
              <span className="task-info-label">Hạn chót</span>
              <span className="task-info-value">
                {task.dueAt ? (
                  <span className={isOverdue ? 'overdue-text' : ''}>
                    {formatTaskDueDate(task.dueAt, task.dueDateKind, timeZone)}
                  </span>
                ) : (
                  <span className="info-empty-val">Không có</span>
                )}
              </span>
            </div>

            {/* Overdue duration */}
            {isOverdue && task.dueAt && (
              <div className="task-info-row" data-testid="task-overdue-duration-row">
                <span className="task-info-label">Đã quá hạn</span>
                <span className="task-info-value overdue-text" style={{ fontWeight: 600 }}>
                  ⚠️ {formatTaskOverdueDuration(task.dueAt, new Date())}
                </span>
              </div>
            )}

            {/* Start date */}
            {task.startAt && (
              <div className="task-info-row">
                <span className="task-info-label">Bắt đầu</span>
                <span className="task-info-value">
                  {formatDisplayDate(new Date(task.startAt), timeZone, 'HH:mm, dd/MM/yyyy')}
                </span>
              </div>
            )}

            {/* Recurrence */}
            <div className="task-info-row">
              <span className="task-info-label">Chu kỳ lặp</span>
              <span className="task-info-value">
                {task.recurrenceRule ? (
                  <span className="recurrence-info-chip">
                    🔁 {formatRecurrenceRuleSummary(task.recurrenceRule) || 'Lặp lại'}
                  </span>
                ) : (
                  <span className="info-empty-val">Không lặp lại</span>
                )}
              </span>
            </div>

            {/* Completed at & Execution duration */}
            {task.completedAt && (
              <>
                <div className="task-info-row">
                  <span className="task-info-label">Hoàn thành lúc</span>
                  <span className="task-info-value completed-time-text">
                    ✓ {formatTaskCompletedAt(task.completedAt, timeZone)}
                  </span>
                </div>
                <div className="task-info-row" data-testid="task-execution-duration-row">
                  <span className="task-info-label">Tổng thời gian thực hiện</span>
                  <span className="task-info-value execution-duration-text">
                    ⏱️ {formatTaskExecutionDuration(task.createdAt, task.completedAt)}
                  </span>
                </div>
              </>
            )}

            {/* Schedule count */}
            <div className="task-info-row">
              <span className="task-info-label">Lịch làm việc</span>
              <span className="task-info-value">
                {scheduleBlocks.length > 0 ? `${scheduleBlocks.length} phiên đã xếp` : <span className="info-empty-val">Chưa xếp lịch</span>}
              </span>
            </div>

            {/* Reminder count */}
            <div className="task-info-row">
              <span className="task-info-label">Lời nhắc</span>
              <span className="task-info-value">
                {taskReminders.length > 0 ? `${taskReminders.length} lời nhắc` : <span className="info-empty-val">Chưa cài đặt</span>}
              </span>
            </div>

            {/* Created At */}
            <div className="task-info-row">
              <span className="task-info-label">Ngày tạo</span>
              <span className="task-info-value info-date-val">
                {formatDisplayDate(new Date(task.createdAt), timeZone, 'HH:mm, dd/MM/yyyy')}
              </span>
            </div>

            {/* Updated At */}
            <div className="task-info-row">
              <span className="task-info-label">Cập nhật lần cuối</span>
              <span className="task-info-value info-date-val">
                {formatDisplayDate(new Date(task.updatedAt), timeZone, 'HH:mm, dd/MM/yyyy')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions Bar */}
      <div className="task-detail-sticky-footer" data-testid="detail-view-sticky-footer">
        <button
          type="button"
          className="btn btn-ghost-danger btn-delete-action"
          onClick={handleDelete}
          disabled={deleteTaskMutation.isPending}
          data-testid="detail-delete-btn"
        >
          🗑️ Xóa công việc
        </button>

        <div className="sticky-footer-right">
          <button
            type="button"
            className="btn btn-secondary btn-close-action"
            onClick={onClose}
          >
            Đóng
          </button>

          {!isCompleted ? (
            <button
              type="button"
              className="btn btn-primary btn-edit-action"
              onClick={onEdit}
              data-testid="detail-edit-btn"
            >
              ✏️ Chỉnh sửa công việc
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-reopen-action"
              onClick={handleToggleComplete}
              disabled={reopenTaskMutation.isPending}
            >
              ↺ Mở lại để chỉnh sửa
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
