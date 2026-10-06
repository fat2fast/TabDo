import React, { useEffect, useMemo, useState } from 'react'
import { fromTaskDueInstant, toTaskDueInstant } from '@tabdo/utils'
import { useAuth } from '../../auth/auth-provider'
import { useCategories } from '../hooks/use-categories'
import { useTaskMutations } from '../hooks/use-task-mutations'
import { useSubtasks, useTaskDetail } from '../hooks/use-tasks'
import type { DueDateKind, Task, TaskPriority, TaskStatus } from '../types'
import {
  cleanDescriptionWithoutAttachments,
  embedTaskAttachments,
  extractTaskAttachments,
  type TaskAttachment,
} from '../utils/task-attachments'
import {
  cleanDescriptionWithoutLinks,
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
  const { data: parentTask } = useTaskDetail(task.parentId)
  const { data: subtasks = [] } = useSubtasks(task.parentId ? null : task.id)

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(
    cleanDescriptionWithoutAttachments(cleanDescriptionWithoutLinks(task.description))
  )
  const [linkedTaskIds, setLinkedTaskIds] = useState<string[]>(extractLinkedTaskIds(task.description))
  const [attachments, setAttachments] = useState<TaskAttachment[]>(extractTaskAttachments(task.description))
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [categoryId, setCategoryId] = useState<string>(task.categoryId || '')
  const [sourceUrl, setSourceUrl] = useState(task.sourceUrl || '')

  // Contextual tabs state for organizing secondary workspaces without infinite scrolling
  const [activeTab, setActiveTab] = useState<'checklist' | 'attachments' | 'related' | 'subtasks'>('checklist')

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

  // Count checklist items
  const checklistCount = useMemo(() => {
    if (!description) return 0
    return description.split('\n').filter((l) => {
      const t = l.trim()
      return t.startsWith('- [ ] ') || t.startsWith('- [x] ') || t.startsWith('- [X] ')
    }).length
  }, [description])

  const statusOptions: DropdownOption<TaskStatus>[] = [
    { value: 'todo', label: 'Cần làm (Todo)', color: '#64748b' },
    { value: 'in_progress', label: 'Đang thực hiện (In Progress)', color: '#0284c7' },
    { value: 'done', label: 'Đã hoàn thành (Done)', color: '#16a34a' },
  ]

  const priorityOptions: DropdownOption<TaskPriority>[] = [
    { value: 'low', label: 'Ưu tiên thấp', color: '#64748b' },
    { value: 'medium', label: 'Trung bình', color: '#f59e0b' },
    { value: 'high', label: 'Ưu tiên cao', color: '#ef4444' },
  ]

  const categoryOptions: DropdownOption<string>[] = [
    { value: '', label: 'Không phân loại (Inbox)' },
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
    setDescription(cleanDescriptionWithoutAttachments(cleanDescriptionWithoutLinks(task.description)))
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

    let fullDescription = description
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
    if (!window.confirm('Bạn có chắc chắn muốn xóa công việc này?')) {
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

        {/* Tab switcher for Checklist / Attachments / Related Tasks / Subtasks */}
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
          </div>
        </div>

        {/* Active Tab Panel */}
        <div className="detail-tab-content-panel">
          {activeTab === 'checklist' && (
            <TaskChecklist
              description={description}
              onChangeDescription={setDescription}
              disabled={updateTaskMutation.isPending}
            />
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
          RIGHT SIDEBAR COLUMN (Properties & Sticky Actions)
          ========================================================================= */}
      <div className="task-detail-sidebar-col">
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

        {/* Sidebar Actions Card */}
        <div className="sidebar-actions-box">
          <button
            type="submit"
            className="btn-primary btn-save-action"
            disabled={updateTaskMutation.isPending}
          >
            {updateTaskMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>

          <div className="sidebar-secondary-actions">
            {onCancel && (
              <button
                type="button"
                className="btn-secondary btn-cancel-action"
                onClick={onCancel}
                disabled={updateTaskMutation.isPending}
              >
                Hủy
              </button>
            )}

            <button
              type="button"
              className="btn-danger-ghost btn-delete-action"
              onClick={handleDelete}
              disabled={deleteTaskMutation.isPending}
            >
              Xóa công việc
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}
