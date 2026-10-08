import React, { useEffect, useMemo, useState } from 'react'
import { fromTaskDueInstant, toTaskDueInstant } from '@tabdo/utils'
import { useAuth } from '../../auth/auth-provider'
import { useCategories } from '../hooks/use-categories'
import { useTaskMutations } from '../hooks/use-task-mutations'
import { useSubtasks, useTaskDetail } from '../hooks/use-tasks'
import type { DueDateKind, Task, TaskPriority, TaskStatus } from '../types'
import {
  embedTaskAttachments,
  extractTaskAttachments,
  type TaskAttachment,
} from '../utils/task-attachments'
import {
  embedTaskChecklist,
  extractTaskChecklist,
  type TaskChecklistItem,
} from '../utils/task-checklist'
import { getCleanTaskDescription } from '../utils/task-description'
import {
  embedLinkedTaskIds,
  extractLinkedTaskIds,
} from '../utils/task-linking'
import { RelatedTasks } from './related-tasks'
import { SubtaskList } from './subtask-list'
import { TaskAttachments } from './task-attachments'
import { TaskChecklist } from './task-checklist'
import { CustomDropdown, type DropdownOption } from './ui/custom-dropdown'
import { DatePickerPopover } from './ui/date-picker-popover'
import { MarkdownDescriptionEditor } from './ui/markdown-description-editor'
import { ScheduleBlockCard } from '../../scheduling/components/schedule-block-card'
import { ScheduleEditor } from '../../scheduling/components/schedule-editor'
import { useScheduleBlocksByTask } from '../../scheduling/hooks/use-schedule-blocks'
import type { ScheduleBlock } from '../../scheduling/types'
import { ReminderList } from '../../reminders/components/reminder-list'
import { useRemindersByTask } from '../../reminders/hooks/use-reminders'
import { useConfirm } from '../../../components/ui'

export interface TaskFormProps {
  task: Task
  onSaveSuccess?: (savedTask: Task) => void
  onCancel?: () => void
  onDeleted?: () => void
  onNavigateParent?: (parentId: string) => void
}

export function TaskForm({
  task,
  onSaveSuccess,
  onCancel,
  onDeleted,
  onNavigateParent,
}: TaskFormProps) {
  const { profile } = useAuth()
  const timeZone = profile?.timezone || 'Asia/Ho_Chi_Minh'
  const { data: categories = [] } = useCategories()
  const { updateTaskMutation, deleteTaskMutation } = useTaskMutations()
  const confirm = useConfirm()
  const { data: parentTask } = useTaskDetail(task.parentId)
  const { data: subtasks = [] } = useSubtasks(task.parentId ? null : task.id)
  const { data: scheduleBlocks = [] } = useScheduleBlocksByTask(task.id)
  const { data: taskReminders = [] } = useRemindersByTask(task.id)
  const [isScheduleEditorOpen, setIsScheduleEditorOpen] = useState(false)
  const [editingScheduleBlock, setEditingScheduleBlock] = useState<ScheduleBlock | null>(null)

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(getCleanTaskDescription(task.description))
  const [checklistItems, setChecklistItems] = useState<TaskChecklistItem[]>(() =>
    extractTaskChecklist(task.description)
  )
  const [linkedTaskIds, setLinkedTaskIds] = useState<string[]>(extractLinkedTaskIds(task.description))
  const [attachments, setAttachments] = useState<TaskAttachment[]>(extractTaskAttachments(task.description))
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [categoryId, setCategoryId] = useState<string>(task.categoryId || '')
  const [sourceUrl, setSourceUrl] = useState(task.sourceUrl || '')

  // Contextual tabs state for organizing secondary workspaces without infinite scrolling
  const [activeTab, setActiveTab] = useState<'checklist' | 'schedule' | 'reminders' | 'subtasks' | 'attachments' | 'related'>('checklist')

  // Due date & kind
  const initialDue = fromTaskDueInstant(task.dueAt, task.dueDateKind, timeZone)
  const [dueDate, setDueDate] = useState(initialDue.dateStr)
  const [dueTime, setDueTime] = useState(initialDue.timeStr)
  const [dueDateKind, setDueDateKind] = useState<DueDateKind>(task.dueDateKind || 'date_time')

  // Start date
  const initialStart = fromTaskDueInstant(task.startAt, 'date_time', timeZone)
  const [startDate, setStartDate] = useState(initialStart.dateStr)
  const [startTime, setStartTime] = useState(initialStart.timeStr)

  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Count checklist items directly from independent checklist state
  const checklistCount = checklistItems.length

  const statusOptions: DropdownOption<TaskStatus>[] = [
    { value: 'todo', label: 'Cần làm', color: '#64748b' },
    { value: 'in_progress', label: 'Đang thực hiện', color: '#0284c7' },
    { value: 'done', label: 'Đã hoàn thành', color: '#16a34a' },
  ]

  const priorityOptions: DropdownOption<TaskPriority>[] = [
    { value: 'low', label: 'Ưu tiên thấp', color: '#64748b' },
    { value: 'medium', label: 'Trung bình', color: '#f59e0b' },
    { value: 'high', label: 'Ưu tiên cao', color: '#ef4444' },
  ]

  const categoryOptions: DropdownOption<string>[] = [
    { value: '', label: 'Không phân loại' },
    ...categories.map((c) => ({
      value: c.id,
      label: c.name,
      color: c.color || '#0284c7',
      icon: c.icon ? <span>{c.icon}</span> : undefined,
    })),
  ]

  // Synchronize when task prop updates from server
  useEffect(() => {
    setTitle(task.title)
    setDescription(getCleanTaskDescription(task.description))
    setChecklistItems(extractTaskChecklist(task.description))
    setLinkedTaskIds(extractLinkedTaskIds(task.description))
    setAttachments(extractTaskAttachments(task.description))
    setStatus(task.status)
    setPriority(task.priority)
    setCategoryId(task.categoryId || '')
    setSourceUrl(task.sourceUrl || '')

    const due = fromTaskDueInstant(task.dueAt, task.dueDateKind, timeZone)
    setDueDate(due.dateStr)
    setDueTime(due.timeStr)
    setDueDateKind(task.dueDateKind || 'date_time')

    const start = fromTaskDueInstant(task.startAt, 'date_time', timeZone)
    setStartDate(start.dateStr)
    setStartTime(start.timeStr)
  }, [task, timeZone])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setErrorMsg('Tiêu đề công việc không được để trống.')
      return
    }

    if (trimmedTitle.length > 500) {
      setErrorMsg('Tiêu đề không được vượt quá 500 ký tự.')
      return
    }

    let fullDescription = getCleanTaskDescription(description)
    fullDescription = embedTaskChecklist(fullDescription, checklistItems)
    fullDescription = embedLinkedTaskIds(fullDescription, linkedTaskIds)
    fullDescription = embedTaskAttachments(fullDescription, attachments)

    if (fullDescription && fullDescription.length > 10000) {
      setErrorMsg('Mô tả không được vượt quá 10,000 ký tự.')
      return
    }

    let calculatedDueAt: string | null = null
    let resolvedDueDateKind: DueDateKind = dueDateKind

    if (dueDate) {
      const timeToUse = dueDateKind === 'date_only' ? null : dueTime
      const instant = toTaskDueInstant(dueDate, timeToUse, timeZone)
      calculatedDueAt = instant.dueAt
      resolvedDueDateKind = instant.dueDateKind
    }

    let calculatedStartAt: string | null = null
    if (startDate) {
      const instant = toTaskDueInstant(startDate, startTime, timeZone)
      calculatedStartAt = instant.dueAt
    }

    // Temporal order validation
    if (calculatedStartAt && calculatedDueAt && calculatedStartAt > calculatedDueAt) {
      setErrorMsg('Thời gian bắt đầu không được sau thời gian hạn chót.')
      return
    }

    try {
      const updated = await updateTaskMutation.mutateAsync({
        id: task.id,
        input: {
          title: trimmedTitle,
          description: fullDescription || null,
          status,
          priority,
          categoryId: categoryId || null,
          dueDateKind: resolvedDueDateKind,
          dueAt: calculatedDueAt,
          startAt: calculatedStartAt,
          sourceUrl: sourceUrl.trim() || null,
        },
        previousTask: task,
      })

      onSaveSuccess?.(updated)
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể lưu thay đổi. Vui lòng kiểm tra lại.')
    }
  }

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
    if (!confirmed) {
      return
    }

    try {
      await deleteTaskMutation.mutateAsync({ id: task.id, parentId: task.parentId })
      onDeleted?.()
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể xóa công việc.')
    }
  }

  return (
    <>
      <form onSubmit={handleSave} className="task-detail-form modern-2col-layout" data-testid="task-form">
      {/* =========================================================================
          LEFT MAIN WORKSPACE COLUMN (Title, Description, Context Tabs)
          ========================================================================= */}
      <div className="task-detail-main-col">
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

        {errorMsg && (
          <div className="alert-error" role="alert">
            {errorMsg}
          </div>
        )}

        {/* Title Input */}
        <div className="form-group main-title-group">
          <label htmlFor="task-title-input" className="field-label-bold">
            Tiêu đề *
          </label>
          <input
            id="task-title-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={500}
            placeholder="Nhập tiêu đề công việc..."
            disabled={updateTaskMutation.isPending}
            className="drawer-title-input"
          />
        </div>

        {/* Description Editor */}
        <div className="form-group main-desc-group">
          <label htmlFor="task-desc-input" className="field-label-bold">
            Mô tả
          </label>
          <MarkdownDescriptionEditor
            id="task-desc-input"
            value={description}
            onChange={setDescription}
            disabled={updateTaskMutation.isPending}
          />
        </div>

        {/* Tab switcher for Checklist / Schedule / Reminders / Subtasks / Attachments / Related */}
        <div className="detail-tabs-header">
          <div className="detail-tabs-nav" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'checklist'}
              className={`detail-tab-pill ${activeTab === 'checklist' ? 'active' : ''}`}
              onClick={() => setActiveTab('checklist')}
            >
              <span className="tab-pill-icon">☑</span> Checklist
              {checklistCount > 0 && <span className="tab-pill-badge">{checklistCount}</span>}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'schedule'}
              className={`detail-tab-pill ${activeTab === 'schedule' ? 'active' : ''}`}
              onClick={() => setActiveTab('schedule')}
            >
              <span className="tab-pill-icon">📅</span> Lịch làm việc
              {scheduleBlocks.length > 0 && <span className="tab-pill-badge">{scheduleBlocks.length}</span>}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'reminders'}
              className={`detail-tab-pill ${activeTab === 'reminders' ? 'active' : ''}`}
              onClick={() => setActiveTab('reminders')}
            >
              <span className="tab-pill-icon">⏰</span> Lời nhắc
              {taskReminders.length > 0 && <span className="tab-pill-badge">{taskReminders.length}</span>}
            </button>

            {!task.parentId && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'subtasks'}
                className={`detail-tab-pill ${activeTab === 'subtasks' ? 'active' : ''}`}
                onClick={() => setActiveTab('subtasks')}
              >
                <span className="tab-pill-icon">↳</span> Việc con
                {subtasks.length > 0 && <span className="tab-pill-badge">{subtasks.length}</span>}
              </button>
            )}

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'attachments'}
              className={`detail-tab-pill ${activeTab === 'attachments' ? 'active' : ''}`}
              onClick={() => setActiveTab('attachments')}
            >
              <span className="tab-pill-icon">📎</span> Đính kèm
              {attachments.length > 0 && <span className="tab-pill-badge">{attachments.length}</span>}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'related'}
              className={`detail-tab-pill ${activeTab === 'related' ? 'active' : ''}`}
              onClick={() => setActiveTab('related')}
            >
              <span className="tab-pill-icon">🔗</span> Liên quan
              {linkedTaskIds.length > 0 && <span className="tab-pill-badge">{linkedTaskIds.length}</span>}
            </button>
          </div>
        </div>

        {/* Active Tab Panel */}
        <div className="detail-tab-content-panel">
          {activeTab === 'checklist' && (
            <TaskChecklist
              items={checklistItems}
              onChangeItems={setChecklistItems}
              disabled={updateTaskMutation.isPending}
            />
          )}

          {activeTab === 'schedule' && (
            <div className="schedule-tab-workspace" data-testid="task-scheduled-sessions-section">
              <div className="tab-workspace-header">
                <div className="workspace-header-info">
                  <h4 className="workspace-tab-title">Lịch làm việc đã xếp</h4>
                  <span className="count-badge">{scheduleBlocks.length}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm add-schedule-session-btn"
                  onClick={() => {
                    setEditingScheduleBlock(null)
                    setIsScheduleEditorOpen(true)
                  }}
                  data-testid="add-schedule-session-btn"
                >
                  <span>+</span> Lên lịch làm việc
                </button>
              </div>

              {scheduleBlocks.length === 0 ? (
                <div className="tab-empty-state">
                  <div className="empty-icon-circle">📅</div>
                  <div className="empty-state-title">Chưa có lịch làm việc cụ thể</div>
                  <p className="empty-state-desc">
                    Xếp lịch làm việc giúp bạn ấn định thời gian tập trung giải quyết công việc này trên Calendar.
                  </p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setEditingScheduleBlock(null)
                      setIsScheduleEditorOpen(true)
                    }}
                  >
                    + Thêm phiên làm việc đầu tiên
                  </button>
                </div>
              ) : (
                <div className="scheduled-blocks-grid">
                  {scheduleBlocks.map((block) => (
                    <ScheduleBlockCard
                      key={block.id}
                      block={block}
                      onEdit={(b) => {
                        setEditingScheduleBlock(b)
                        setIsScheduleEditorOpen(true)
                      }}
                      onDelete={(b) => {
                        setEditingScheduleBlock(b)
                        setIsScheduleEditorOpen(true)
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'reminders' && (
            <div className="reminders-tab-workspace">
              <ReminderList task={task} />
            </div>
          )}

          {activeTab === 'attachments' && (
            <TaskAttachments
              attachments={attachments}
              onChangeAttachments={setAttachments}
              disabled={updateTaskMutation.isPending}
            />
          )}

          {activeTab === 'related' && (
            <RelatedTasks
              currentTask={task}
              linkedTaskIds={linkedTaskIds}
              onUpdateLinkedTaskIds={setLinkedTaskIds}
              onSelectTask={onNavigateParent}
              disabled={updateTaskMutation.isPending}
            />
          )}

          {activeTab === 'subtasks' && !task.parentId && (
            <div className="subtasks-tab-wrapper">
              <SubtaskList parentTask={task} onSelectSubtask={onNavigateParent} />
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          RIGHT SIDEBAR COLUMN (Compact Properties & Summary)
          ========================================================================= */}
      <div className="task-detail-sidebar-col">
        {/* Box 1: Core Properties */}
        <div className="sidebar-properties-box">
          <div className="sidebar-box-header">
            <span className="sidebar-header-icon">⚙️</span>
            <span className="sidebar-box-title">Thuộc tính</span>
          </div>

          <div className="sidebar-prop-item">
            <label className="prop-label">Trạng thái</label>
            <CustomDropdown
              value={status}
              options={statusOptions}
              onChange={setStatus}
              ariaLabel="Trạng thái"
              disabled={updateTaskMutation.isPending}
            />
          </div>

          <div className="sidebar-prop-item">
            <label className="prop-label">Mức độ ưu tiên</label>
            <CustomDropdown
              value={priority}
              options={priorityOptions}
              onChange={setPriority}
              ariaLabel="Mức độ ưu tiên"
              disabled={updateTaskMutation.isPending}
            />
          </div>

          <div className="sidebar-prop-item">
            <label className="prop-label">Danh mục</label>
            <CustomDropdown
              value={categoryId}
              options={categoryOptions}
              onChange={setCategoryId}
              ariaLabel="Danh mục"
              disabled={updateTaskMutation.isPending}
            />
          </div>

          <div className="sidebar-prop-item">
            <label htmlFor="task-source-url" className="prop-label">
              URL nguồn
            </label>
            <input
              id="task-source-url"
              type="url"
              value={sourceUrl}
              placeholder="https://example.com"
              onChange={(e) => setSourceUrl(e.target.value)}
              disabled={updateTaskMutation.isPending}
              className="sidebar-url-input"
            />
          </div>
        </div>

        {/* Box 2: Time, Scheduling & Reminders (Prominently displayed right in view) */}
        <div className="sidebar-properties-box sidebar-summary-card">
          <div className="sidebar-box-header">
            <span className="sidebar-header-icon">⏱️</span>
            <span className="sidebar-box-title">Thời gian & Lời nhắc</span>
          </div>

          <div className="sidebar-prop-item">
            <label className="prop-label">Hạn chót</label>
            <DatePickerPopover
              dueDate={dueDate}
              dueTime={dueTime}
              dueDateKind={dueDateKind}
              timeZone={timeZone}
              onChangeDate={setDueDate}
              onChangeTime={setDueTime}
              onChangeKind={setDueDateKind}
              disabled={updateTaskMutation.isPending}
            />
          </div>

          <div className="sidebar-summary-item">
            <div className="summary-item-text">
              <span className="summary-item-title">Lịch làm việc</span>
              <span className="summary-item-desc">
                {scheduleBlocks.length === 0
                  ? 'Chưa lên lịch'
                  : `${scheduleBlocks.length} phiên đã xếp`}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-xs summary-action-btn"
              onClick={() => {
                if (scheduleBlocks.length === 0) {
                  setEditingScheduleBlock(null)
                  setIsScheduleEditorOpen(true)
                } else {
                  setActiveTab('schedule')
                }
              }}
              title={scheduleBlocks.length === 0 ? 'Thêm lịch làm việc' : 'Mở tab Lịch làm việc'}
            >
              {scheduleBlocks.length === 0 ? '+ Lên lịch' : 'Chi tiết →'}
            </button>
          </div>

          <div className="sidebar-summary-item">
            <div className="summary-item-text">
              <span className="summary-item-title">Lời nhắc</span>
              <span className="summary-item-desc">
                {taskReminders.length === 0
                  ? 'Chưa đặt lời nhắc'
                  : `${taskReminders.length} lời nhắc đang bật`}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-xs summary-action-btn"
              onClick={() => setActiveTab('reminders')}
              title="Mở tab Lời nhắc"
            >
              {taskReminders.length === 0 ? '+ Đặt nhắc' : 'Chi tiết →'}
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          STICKY BOTTOM ACTIONS BAR (Always visible without scrolling)
          ========================================================================= */}
      <div className="task-detail-sticky-footer" data-testid="task-form-sticky-footer">
        <button
          type="button"
          className="btn btn-danger-ghost btn-delete-action"
          onClick={handleDelete}
          disabled={deleteTaskMutation.isPending}
          title="Xóa công việc này"
        >
          <svg
            width="15"
            height="15"
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
          <span>Xóa công việc</span>
        </button>

        <div className="sticky-footer-right">
          {onCancel && (
            <button
              type="button"
              className="btn btn-secondary btn-cancel-action"
              onClick={onCancel}
              disabled={updateTaskMutation.isPending}
            >
              Hủy
            </button>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-save-action"
            disabled={updateTaskMutation.isPending}
          >
            {updateTaskMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </form>

    <ScheduleEditor
      isOpen={isScheduleEditorOpen}
      onClose={() => setIsScheduleEditorOpen(false)}
      initialBlock={editingScheduleBlock}
      initialTask={task}
    />
  </>
)
}
