import React, { useEffect, useState } from 'react'
import { toTaskDueInstant, formatDisplayDate, RELATIVE_REMINDER_PRESETS } from '@tabdo/utils'
import type { DueDateKind, Task, TaskPriority } from '../types'
import { useOptionalAuth } from '../../auth/auth-provider'
import { useCategories } from '../hooks/use-categories'
import { useTaskMutations } from '../hooks/use-task-mutations'
import { useScheduleBlockMutations } from '../../scheduling/hooks/use-schedule-block-mutations'
import { useReminderMutations } from '../../reminders/hooks/use-reminder-mutations'
import { CustomDropdown, type DropdownOption } from './ui/custom-dropdown'
import { DatePickerPopover } from './ui/date-picker-popover'
import { MarkdownDescriptionEditor } from './ui/markdown-description-editor'
import { RecurrenceSelector } from './recurrence-selector'
import { TaskChecklist } from './task-checklist'
import { TaskAttachments } from './task-attachments'
import { RelatedTasks } from './related-tasks'
import { DatePicker } from '../../../components/ui/date-picker'
import { TimePicker24h } from '../../../components/ui/time-picker-24h'
import {
  embedTaskChecklist,
  type TaskChecklistItem,
} from '../utils/task-checklist'
import {
  embedTaskAttachments,
  type TaskAttachment,
} from '../utils/task-attachments'
import { embedLinkedTaskIds } from '../utils/task-linking'
import { getCleanTaskDescription } from '../utils/task-description'
import { AutoResizeTextarea } from '../../../components/ui/auto-resize-textarea'

export interface TaskCreateModalProps {
  isOpen: boolean
  onClose: () => void
  initialTitle?: string
  defaultCategoryId?: string | null
  onTaskCreated?: (task: Task) => void
}

export function TaskCreateModal({
  isOpen,
  onClose,
  initialTitle = '',
  defaultCategoryId = '',
  onTaskCreated,
}: TaskCreateModalProps) {
  const auth = useOptionalAuth()
  const timeZone = auth?.profile?.timezone || 'Asia/Ho_Chi_Minh'
  const { data: categories = [] } = useCategories()
  const { createTaskMutation } = useTaskMutations()
  const { createMutation: createScheduleMutation } = useScheduleBlockMutations()
  const { createMutation: createReminderMutation } = useReminderMutations()

  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [categoryId, setCategoryId] = useState<string>(defaultCategoryId || '')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [dueDateKind, setDueDateKind] = useState<DueDateKind>('date_time')
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Utility tabs state
  const [activeTab, setActiveTab] = useState<'checklist' | 'schedule' | 'reminders' | 'subtasks' | 'attachments' | 'related'>('checklist')
  const [checklistItems, setChecklistItems] = useState<TaskChecklistItem[]>([])
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [linkedTaskIds, setLinkedTaskIds] = useState<string[]>([])
  
  // Draft subtasks state
  const [draftSubtasks, setDraftSubtasks] = useState<string[]>([])
  const [newSubtaskInput, setNewSubtaskInput] = useState('')

  // Draft schedule state
  const [enableSchedule, setEnableSchedule] = useState(false)
  const todayStr = formatDisplayDate(new Date(), timeZone, 'yyyy-MM-dd')
  const [schedStartDate, setSchedStartDate] = useState(todayStr)
  const [schedStartTime, setSchedStartTime] = useState('09:00')
  const [schedEndDate, setSchedEndDate] = useState(todayStr)
  const [schedEndTime, setSchedEndTime] = useState('10:00')

  // Draft reminder state
  const [enableReminder, setEnableReminder] = useState(false)
  const [reminderDate, setReminderDate] = useState('')
  const [reminderTime, setReminderTime] = useState('09:00')
  const [reminderKindLabel, setReminderKindLabel] = useState<string>('Tùy chỉnh')
  const [showCustomReminderPicker, setShowCustomReminderPicker] = useState(false)

  // Sync initial values when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle || '')
      setDescription('')
      setPriority('medium')
      setCategoryId(defaultCategoryId || '')
      setDueDate('')
      setDueTime('')
      setDueDateKind('date_time')
      setRecurrenceRule(null)
      setSourceUrl('')
      setErrorMsg(null)
      setActiveTab('checklist')
      setChecklistItems([])
      setAttachments([])
      setLinkedTaskIds([])
      setDraftSubtasks([])
      setNewSubtaskInput('')
      setEnableSchedule(false)
      setSchedStartDate(todayStr)
      setSchedStartTime('09:00')
      setSchedEndDate(todayStr)
      setSchedEndTime('10:00')
      setEnableReminder(false)
      setReminderDate('')
      setReminderTime('09:00')
      setReminderKindLabel('Tùy chỉnh')
      setShowCustomReminderPicker(false)
    }
  }, [isOpen, initialTitle, defaultCategoryId, todayStr])

  // Support hotkey Escape to close the modal
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

  // Add draft subtask helper
  const handleAddDraftSubtask = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = newSubtaskInput.trim()
    if (!trimmed) return
    setDraftSubtasks((prev) => [...prev, trimmed])
    setNewSubtaskInput('')
  }

  const handleRemoveDraftSubtask = (index: number) => {
    setDraftSubtasks((prev) => prev.filter((_, i) => i !== index))
  }

  // Quick schedule duration helper
  const handleAddDuration = (minutes: number) => {
    if (!schedStartTime) return
    const [h, m] = schedStartTime.split(':').map(Number)
    const totalMinutes = h * 60 + m + minutes
    const endH = Math.floor(totalMinutes / 60) % 24
    const endM = totalMinutes % 60
    setSchedEndDate(schedStartDate)
    setSchedEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`)
  }

  const hasTimedDue = Boolean(dueDate && dueDateKind === 'date_time')

  // Handle preset click matching ReminderPresetPicker
  const handleSelectPreset = (offsetMinutes: number, label: string) => {
    if (!dueDate) return
    const timeToUse = dueDateKind === 'date_only' ? '18:00' : dueTime || '18:00'
    const dueInstant = toTaskDueInstant(dueDate, timeToUse, timeZone)
    if (!dueInstant.dueAt) return

    const targetDate = new Date(new Date(dueInstant.dueAt).getTime() - offsetMinutes * 60 * 1000)
    setReminderDate(formatDisplayDate(targetDate, timeZone, 'yyyy-MM-dd'))
    setReminderTime(formatDisplayDate(targetDate, timeZone, 'HH:mm'))
    setReminderKindLabel(label)
    setEnableReminder(true)
    setShowCustomReminderPicker(false)
  }

  const handleCustomReminderClick = () => {
    setEnableReminder(true)
    if (!reminderDate) {
      setReminderDate(dueDate || todayStr)
    }
    setReminderKindLabel('Cố định')
    setShowCustomReminderPicker(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
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

    let resolvedRecurrenceRule: string | null = null
    let resolvedSeriesId: string | null = null
    let resolvedAnchorAt: string | null = null
    let resolvedTimezone: string | null = null

    if (recurrenceRule) {
      if (!calculatedDueAt) {
        setErrorMsg('Cần đặt ngày đến hạn trước khi thiết lập lặp lại.')
        return
      }
      resolvedRecurrenceRule = recurrenceRule
      resolvedSeriesId = crypto.randomUUID()
      resolvedTimezone = timeZone
      resolvedAnchorAt = calculatedDueAt
    }

    // Validate schedule if enabled
    if (enableSchedule && schedStartDate && schedEndDate) {
      const startInstant = toTaskDueInstant(schedStartDate, schedStartTime, timeZone)
      const endInstant = toTaskDueInstant(schedEndDate, schedEndTime, timeZone)
      if (startInstant.dueAt && endInstant.dueAt && new Date(endInstant.dueAt).getTime() <= new Date(startInstant.dueAt).getTime()) {
        setErrorMsg('Thời gian kết thúc lịch làm việc phải sau thời gian bắt đầu.')
        return
      }
    }

    try {
      const created = await createTaskMutation.mutateAsync({
        title: trimmedTitle,
        description: fullDescription || null,
        priority,
        categoryId: categoryId || null,
        status: 'todo',
        dueAt: calculatedDueAt,
        dueDateKind: resolvedDueDateKind,
        sourceUrl: sourceUrl.trim() || null,
        recurrenceRule: resolvedRecurrenceRule,
        recurrenceSeriesId: resolvedSeriesId,
        recurrenceAnchorAt: resolvedAnchorAt,
        recurrenceTimezone: resolvedTimezone,
      })

      // Create linked schedule block if enabled
      if (enableSchedule && schedStartDate && schedEndDate) {
        try {
          const startInstant = toTaskDueInstant(schedStartDate, schedStartTime, timeZone)
          const endInstant = toTaskDueInstant(schedEndDate, schedEndTime, timeZone)
          if (startInstant.dueAt && endInstant.dueAt) {
            await createScheduleMutation.mutateAsync({
              taskId: created.id,
              title: created.title,
              startAt: startInstant.dueAt,
              endAt: endInstant.dueAt,
            })
          }
        } catch (schedErr) {
          console.warn('Could not auto-create schedule block:', schedErr)
        }
      }

      // Create linked reminder if enabled
      if (enableReminder && reminderDate) {
        try {
          const remInstant = toTaskDueInstant(reminderDate, reminderTime, timeZone)
          if (remInstant.dueAt) {
            await createReminderMutation.mutateAsync({
              taskId: created.id,
              reminderKind: 'absolute',
              remindAt: remInstant.dueAt,
            })
          }
        } catch (remErr) {
          console.warn('Could not auto-create reminder:', remErr)
        }
      }

      // Create draft subtasks if any
      if (draftSubtasks.length > 0) {
        for (const subTitle of draftSubtasks) {
          try {
            await createTaskMutation.mutateAsync({
              title: subTitle,
              parentId: created.id,
              status: 'todo',
              priority: 'medium',
            })
          } catch (subErr) {
            console.warn('Could not auto-create subtask:', subErr)
          }
        }
      }

      onTaskCreated?.(created)
      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể tạo công việc. Vui lòng thử lại.')
    }
  }

  const isSaving =
    createTaskMutation.isPending ||
    createScheduleMutation.isPending ||
    createReminderMutation.isPending

  return (
    <div
      className="task-drawer-backdrop"
      data-testid="task-create-modal-backdrop"
    >
      <div
        className="task-drawer-panel task-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="create-task-title"
        data-testid="task-create-modal"
      >
        <div className="drawer-header">
          <div className="drawer-title-group">
            <h3 id="create-task-title" className="drawer-title">
              Tạo công việc mới
            </h3>
            <span className="create-modal-badge">Chi tiết đầy đủ</span>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Đóng cửa sổ tạo công việc"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="drawer-body">
          <form
            onSubmit={handleSubmit}
            className="task-detail-form modern-2col-layout"
            data-testid="task-create-form"
          >
            {/* Left Column: Title, Description & Utility Tabs */}
            <div className="task-detail-main-col">
              {errorMsg && (
                <div className="alert-error" role="alert">
                  {errorMsg}
                </div>
              )}

              <div className="form-group main-title-group">
                <label htmlFor="create-task-title-input" className="field-label-bold">
                  Tiêu đề *
                </label>
                <AutoResizeTextarea
                  id="create-task-title-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  autoFocus
                  maxLength={500}
                  placeholder="Nhập tiêu đề công việc..."
                  disabled={isSaving}
                  className="drawer-title-input"
                />
              </div>

              <div className="form-group main-desc-group">
                <label htmlFor="create-task-desc-input" className="field-label-bold">
                  Mô tả / Ghi chú chi tiết
                </label>
                <MarkdownDescriptionEditor
                  id="create-task-desc-input"
                  value={description}
                  onChange={setDescription}
                  placeholder="Thêm mô tả, ghi chú chi tiết hoặc checklist..."
                  disabled={isSaving}
                />
              </div>

              {/* Workspace Vertical Tabs Layout (Checklist, Lịch làm việc, Lời nhắc, Việc con, Đính kèm, Liên kết) */}
              <div className="workspace-tabs-vertical-layout">
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
                    {enableSchedule && <span className="tab-btn-badge">1</span>}
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
                    {enableReminder && <span className="tab-btn-badge">1</span>}
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'subtasks'}
                    className={`vertical-tab-btn ${activeTab === 'subtasks' ? 'active' : ''}`}
                    onClick={() => setActiveTab('subtasks')}
                  >
                    <span className="tab-btn-icon">↳</span>
                    <span className="tab-btn-label">Việc con</span>
                    {draftSubtasks.length > 0 && (
                      <span className="tab-btn-badge">{draftSubtasks.length}</span>
                    )}
                  </button>

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

                {/* Vertical Tabs Active Panel */}
                <div className="vertical-tabs-panel">
                  {/* 1. Checklist Panel */}
                  {activeTab === 'checklist' && (
                    <TaskChecklist
                      items={checklistItems}
                      onChangeItems={setChecklistItems}
                      disabled={isSaving}
                    />
                  )}

                  {/* 2. Schedule Panel */}
                  {activeTab === 'schedule' && (
                    <div className="schedule-tab-workspace" data-testid="task-scheduled-sessions-section">
                      <div className="tab-workspace-header">
                        <div className="workspace-header-info">
                          <h4 className="workspace-tab-title">Lịch làm việc đã xếp</h4>
                          <span className="count-badge">{enableSchedule ? 1 : 0}</span>
                        </div>
                        {!enableSchedule && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm add-schedule-session-btn"
                            onClick={() => setEnableSchedule(true)}
                            data-testid="add-schedule-session-btn"
                          >
                            <span>+</span> Lên lịch làm việc
                          </button>
                        )}
                      </div>

                      {!enableSchedule ? (
                        <div className="tab-empty-state">
                          <div className="empty-icon-circle">📅</div>
                          <div className="empty-state-title">Chưa có lịch làm việc cụ thể</div>
                          <p className="empty-state-desc">
                            Lên lịch làm việc cho công việc này trên Calendar giúp bạn ấn định thời gian tập trung giải quyết công việc.
                          </p>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEnableSchedule(true)}
                          >
                            + Thêm phiên làm việc
                          </button>
                        </div>
                      ) : (
                        <div className="schedule-create-box">
                          <div className="schedule-session-card">
                            <div className="session-card-header">
                              <div className="session-card-title">
                                <span className="schedule-dot" />
                                <strong>Phiên tập trung dự kiến trên Calendar</strong>
                              </div>
                              <button
                                type="button"
                                className="btn btn-ghost-sm btn-danger-text"
                                onClick={() => setEnableSchedule(false)}
                                title="Hủy xếp lịch"
                              >
                                ✕ Hủy lịch
                              </button>
                            </div>

                            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
                              <div>
                                <label className="field-label-sm" style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                                  Ngày bắt đầu
                                </label>
                                <DatePicker
                                  value={schedStartDate}
                                  onChange={(d) => {
                                    setSchedStartDate(d)
                                    if (!schedEndDate || schedEndDate < d) setSchedEndDate(d)
                                  }}
                                  timeZone={timeZone}
                                  disabled={isSaving}
                                />
                              </div>
                              <div>
                                <label className="field-label-sm" style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                                  Giờ bắt đầu (24h)
                                </label>
                                <TimePicker24h
                                  value={schedStartTime}
                                  onChange={setSchedStartTime}
                                  disabled={isSaving}
                                />
                              </div>
                            </div>

                            {/* Quick duration buttons */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', margin: '10px 0' }}>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Thời lượng nhanh:</span>
                              {[
                                { label: '+15p', min: 15 },
                                { label: '+30p', min: 30 },
                                { label: '+45p', min: 45 },
                                { label: '+1h', min: 60 },
                                { label: '+2h', min: 120 },
                              ].map((item) => (
                                <button
                                  key={item.label}
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '2px 8px', fontSize: '0.75rem', height: '26px' }}
                                  onClick={() => handleAddDuration(item.min)}
                                  disabled={isSaving}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>

                            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <div>
                                <label className="field-label-sm" style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                                  Ngày kết thúc
                                </label>
                                <DatePicker
                                  value={schedEndDate}
                                  onChange={setSchedEndDate}
                                  timeZone={timeZone}
                                  disabled={isSaving}
                                />
                              </div>
                              <div>
                                <label className="field-label-sm" style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                                  Giờ kết thúc (24h)
                                </label>
                                <TimePicker24h
                                  value={schedEndTime}
                                  onChange={setSchedEndTime}
                                  disabled={isSaving}
                                />
                              </div>
                            </div>

                            <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                              Múi giờ áp dụng: <strong>{timeZone}</strong>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. Reminders Panel */}
                  {activeTab === 'reminders' && (
                    <div className="reminders-tab-workspace" data-testid="task-reminders-section">
                      <div className="tab-workspace-header">
                        <div className="workspace-header-info">
                          <h4 className="workspace-tab-title">⏰ Lời nhắc</h4>
                          <span className="count-badge">{enableReminder ? 1 : 0}</span>
                        </div>
                      </div>

                      {!enableReminder ? (
                        <div className="tabdo-reminder-preset-picker" data-testid="reminder-preset-picker">
                          <div className="no-reminders-hint" style={{ marginBottom: '10px' }}>
                            Chưa thiết lập lời nhắc nào cho công việc này. Tạo lời nhắc cho công việc này bằng cách chọn nhanh mốc thời gian hoặc tùy chỉnh giờ cụ thể:
                          </div>
                          <div className="preset-options-group">
                            {RELATIVE_REMINDER_PRESETS.map((preset) => (
                              <button
                                key={preset.offsetMinutes}
                                type="button"
                                className="btn btn-outline btn-xs preset-btn"
                                disabled={!hasTimedDue}
                                onClick={() => handleSelectPreset(preset.offsetMinutes, preset.label)}
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
                              onClick={handleCustomReminderClick}
                              title="Tạo lời nhắc vào thời điểm cố định"
                              data-testid="custom-reminder-btn"
                            >
                              🕒 Tùy chỉnh giờ...
                            </button>
                          </div>

                          {!hasTimedDue && (
                            <div className="preset-disabled-hint" data-testid="relative-disabled-hint" style={{ marginTop: '8px' }}>
                              💡 Đặt hạn chót có giờ cụ thể để kích hoạt các lời nhắc theo hạn chót.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="reminders-items-container">
                          <div className="reminder-item-card status-pending">
                            <div className="reminder-item-main">
                              <div className="reminder-item-time">
                                <span>
                                  ⏰ {reminderDate ? `${reminderTime} ngày ${formatDisplayDate(new Date(reminderDate), timeZone, 'dd/MM/yyyy')}` : 'Lời nhắc dự kiến'}
                                </span>
                                <span className="reminder-kind-tag">
                                  {reminderKindLabel}
                                </span>
                              </div>
                              <div className="reminder-status-note">
                                Dự kiến tạo tự động khi lưu công việc
                              </div>
                            </div>

                            <div className="reminder-item-actions">
                              <button
                                type="button"
                                className="btn btn-outline btn-xs"
                                onClick={() => setShowCustomReminderPicker((prev) => !prev)}
                              >
                                {showCustomReminderPicker ? 'Thu gọn' : 'Chỉnh sửa'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost-sm btn-danger-text"
                                onClick={() => {
                                  setEnableReminder(false)
                                  setShowCustomReminderPicker(false)
                                }}
                                title="Hủy lời nhắc"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {showCustomReminderPicker && (
                            <div className="custom-reminder-editor-box" style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', marginTop: '10px' }}>
                              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                  <label className="field-label-sm" style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                                    Ngày nhắc
                                  </label>
                                  <DatePicker
                                    value={reminderDate}
                                    onChange={setReminderDate}
                                    timeZone={timeZone}
                                    disabled={isSaving}
                                  />
                                </div>
                                <div>
                                  <label className="field-label-sm" style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                                    Giờ nhắc (24h)
                                  </label>
                                  <TimePicker24h
                                    value={reminderTime}
                                    onChange={setReminderTime}
                                    disabled={isSaving}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. Subtasks Panel */}
                  {activeTab === 'subtasks' && (
                    <div className="subtasks-tab-workspace">
                      <div className="tab-workspace-header">
                        <div className="workspace-header-info">
                          <h4 className="workspace-tab-title">Danh sách việc con dự kiến</h4>
                          <span className="count-badge">{draftSubtasks.length}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <input
                          type="text"
                          value={newSubtaskInput}
                          onChange={(e) => setNewSubtaskInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleAddDraftSubtask()
                            }
                          }}
                          placeholder="Nhập tiêu đề việc con và nhấn Enter..."
                          disabled={isSaving}
                          className="form-control"
                          style={{ flex: 1, height: '36px', fontSize: '0.8125rem' }}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handleAddDraftSubtask}
                          disabled={isSaving || !newSubtaskInput.trim()}
                          style={{ height: '36px', whiteSpace: 'nowrap' }}
                        >
                          + Thêm việc con
                        </button>
                      </div>

                      {draftSubtasks.length === 0 ? (
                        <div className="tab-empty-state">
                          <div className="empty-icon-circle">↳</div>
                          <div className="empty-state-title">Chưa có việc con nào</div>
                          <p className="empty-state-desc">
                            Nhập tiêu đề ở trên để chia nhỏ công việc thành các bước con phụ thuộc.
                          </p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {draftSubtasks.map((st, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                fontSize: '0.8125rem',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: '#0284c7', fontWeight: 600 }}>↳</span>
                                <span style={{ color: '#1e293b' }}>{st}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveDraftSubtask(idx)}
                                disabled={isSaving}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#94a3b8',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                }}
                                title="Xóa việc con này"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 5. Attachments Panel */}
                  {activeTab === 'attachments' && (
                    <TaskAttachments
                      attachments={attachments}
                      onChangeAttachments={setAttachments}
                      disabled={isSaving}
                    />
                  )}

                  {/* 6. Related Tasks Panel */}
                  {activeTab === 'related' && (
                    <RelatedTasks
                      currentTask={null}
                      linkedTaskIds={linkedTaskIds}
                      onUpdateLinkedTaskIds={setLinkedTaskIds}
                      disabled={isSaving}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Properties & Schedule */}
            <div className="task-detail-sidebar-col">
              {/* Properties Box */}
              <div className="sidebar-properties-box">
                <div className="sidebar-box-header">
                  <span className="sidebar-header-icon">⚙️</span>
                  <span className="sidebar-box-title">Thuộc tính</span>
                </div>

                <div className="sidebar-prop-item">
                  <label className="prop-label">Mức độ ưu tiên</label>
                  <CustomDropdown
                    value={priority}
                    options={priorityOptions}
                    onChange={setPriority}
                    ariaLabel="Mức độ ưu tiên"
                    disabled={isSaving}
                  />
                </div>

                <div className="sidebar-prop-item">
                  <label className="prop-label">Danh mục</label>
                  <CustomDropdown
                    value={categoryId}
                    options={categoryOptions}
                    onChange={setCategoryId}
                    ariaLabel="Danh mục"
                    disabled={isSaving}
                  />
                </div>

                <div className="sidebar-prop-item">
                  <label htmlFor="create-task-source-url" className="prop-label">
                    URL nguồn
                  </label>
                  <input
                    id="create-task-source-url"
                    type="url"
                    value={sourceUrl}
                    placeholder="https://example.com"
                    onChange={(e) => setSourceUrl(e.target.value)}
                    disabled={isSaving}
                    className="sidebar-url-input"
                  />
                </div>
              </div>

              {/* Time & Recurrence Box */}
              <div className="sidebar-properties-box sidebar-summary-card">
                <div className="sidebar-box-header">
                  <span className="sidebar-header-icon">⏱️</span>
                  <span className="sidebar-box-title">Thời gian & Lặp lại</span>
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
                    onClear={() => {
                      setDueDate('')
                      setDueTime('')
                    }}
                    disabled={isSaving}
                  />
                </div>

                <div className="sidebar-prop-item">
                  <RecurrenceSelector
                    value={recurrenceRule}
                    onChange={setRecurrenceRule}
                    hasDueDate={Boolean(dueDate)}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>

            {/* Sticky Bottom Actions Bar */}
            <div className="task-detail-sticky-footer" data-testid="create-modal-sticky-footer">
              <div />

              <div className="sticky-footer-right">
                <button
                  type="button"
                  className="btn btn-secondary btn-cancel-action"
                  onClick={onClose}
                  disabled={isSaving}
                >
                  Hủy
                </button>

                <button
                  type="submit"
                  className="btn btn-primary btn-save-action"
                  disabled={isSaving || !title.trim()}
                >
                  {isSaving ? 'Đang tạo...' : '+ Tạo công việc'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
