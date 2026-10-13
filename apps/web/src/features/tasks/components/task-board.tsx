import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/auth-provider'
import { useI18n } from '../../i18n/i18n-provider'
import { useConfirm } from '../../../components/ui'
import { useTaskBoardLane } from '../hooks/use-tasks'
import { useTaskMutations } from '../hooks/use-task-mutations'
import type { TaskViewSearchParams } from '../hooks/use-task-view-search-params'
import type { BoardLaneStatus, Task, TaskBoardLaneQueryInput, TaskStatus, TaskView } from '../types'
import { TaskBoardCard } from './task-board-card'


export interface TaskBoardProps {
  currentView: TaskView
  params: TaskViewSearchParams
  onSelectTask: (taskId: string) => void
  now: Date
}

interface LaneConfig {
  status: BoardLaneStatus
  titleKey: 'tasks.laneTodo' | 'tasks.laneInProgress' | 'tasks.laneDone'
}

const LANES: LaneConfig[] = [
  { status: 'todo', titleKey: 'tasks.laneTodo' },
  { status: 'in_progress', titleKey: 'tasks.laneInProgress' },
  { status: 'done', titleKey: 'tasks.laneDone' },
]

export function TaskBoard({ currentView, params, onSelectTask, now }: TaskBoardProps) {
  const { t } = useI18n()
  const { profile } = useAuth()
  const timeZone = profile?.timezone || 'Asia/Ho_Chi_Minh'
  const confirm = useConfirm()
  const { changeTaskStatusMutation } = useTaskMutations()

  // Mobile active lane tab
  const [activeMobileLane, setActiveMobileLane] = useState<BoardLaneStatus>('todo')
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null)

  // Status transition & reordering handler with warning alert for blocked recurrence
  const handleStatusChange = async (task: Task, targetStatus: TaskStatus, targetBoardOrder?: number) => {
    if (task.status === targetStatus && targetBoardOrder === undefined) return
    if (pendingTaskId) return

    setPendingTaskId(task.id)

    changeTaskStatusMutation.mutate(
      { task, targetStatus, boardOrder: targetBoardOrder },
      {
        onSettled: () => {
          setPendingTaskId(null)
        },
        onError: (err: any) => {
          const message = err?.message || ''
          const isRecurrenceBlocked =
            message.includes('RECURRING_TASK_HAS_SUCCESSOR') ||
            message.includes('phiên lặp tiếp theo') ||
            message.includes('lượt tiếp theo') ||
            message.includes('existing successor')

          if (isRecurrenceBlocked) {
            confirm({
              title: t('tasks.statusChangeBlockedRecurrenceTitle'),
              message: t('tasks.statusChangeBlockedRecurrence'),
              confirmText: 'Đã hiểu',
              cancelText: null,
              variant: 'warning',
            })
          } else {
            confirm({
              title: 'Lỗi cập nhật trạng thái',
              message: message || 'Không thể cập nhật trạng thái công việc. Vui lòng thử lại.',
              confirmText: 'Đóng',
              cancelText: null,
              variant: 'danger',
            })
          }
        },
      }
    )
  }

  return (
    <div className="task-board-wrapper" data-testid="task-board">
      {/* Mobile Lane Selector Tabs */}
      <div
        className="task-board-mobile-tabs"
        role="tablist"
        aria-label="Chọn cột bảng công việc"
      >
        {LANES.map((lane) => (
          <button
            key={lane.status}
            role="tab"
            aria-selected={activeMobileLane === lane.status}
            aria-controls={`lane-panel-${lane.status}`}
            id={`lane-tab-${lane.status}`}
            className={`task-board-mobile-tab ${
              activeMobileLane === lane.status ? 'active' : ''
            }`}
            onClick={() => setActiveMobileLane(lane.status)}
          >
            {t(lane.titleKey)}
          </button>
        ))}
      </div>

      {/* Kanban Lanes Grid */}
      <div className="task-board-lanes-grid">
        {LANES.map((lane) => (
          <TaskBoardLane
            key={lane.status}
            lane={lane.status}
            title={t(lane.titleKey)}
            currentView={currentView}
            params={params}
            timeZone={timeZone}
            now={now}
            isMobileActive={activeMobileLane === lane.status}
            pendingTaskId={pendingTaskId}
            onSelectTask={onSelectTask}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>
    </div>
  )
}

function calculateNewBoardOrder(itemsWithoutMoved: Task[], targetIndex: number): number {
  if (itemsWithoutMoved.length === 0) {
    return Date.now() / 1000
  }

  const getOrder = (t: Task): number => {
    if (typeof t.boardOrder === 'number' && !Number.isNaN(t.boardOrder)) {
      return t.boardOrder
    }
    const ms = new Date(t.createdAt).getTime()
    return Number.isNaN(ms) ? 0 : ms / 1000
  }

  // Dropped at the very top (index 0)
  if (targetIndex <= 0) {
    const topOrder = getOrder(itemsWithoutMoved[0])
    return topOrder + 1000
  }

  // Dropped at the very bottom (after last item)
  if (targetIndex >= itemsWithoutMoved.length) {
    const bottomOrder = getOrder(itemsWithoutMoved[itemsWithoutMoved.length - 1])
    return bottomOrder - 1000
  }

  // Dropped between itemsWithoutMoved[targetIndex - 1] and itemsWithoutMoved[targetIndex]
  const aboveOrder = getOrder(itemsWithoutMoved[targetIndex - 1])
  const belowOrder = getOrder(itemsWithoutMoved[targetIndex])

  if (aboveOrder === belowOrder) {
    return aboveOrder + 0.5
  }
  return (aboveOrder + belowOrder) / 2
}

interface TaskBoardLaneProps {
  lane: BoardLaneStatus
  title: string
  currentView: TaskView
  params: TaskViewSearchParams
  timeZone: string
  now: Date
  isMobileActive: boolean
  pendingTaskId: string | null
  onSelectTask: (taskId: string) => void
  onStatusChange: (task: Task, targetStatus: TaskStatus, targetBoardOrder?: number) => void
}

function TaskBoardLane({
  lane,
  title,
  currentView,
  params,
  timeZone,
  now,
  isMobileActive,
  pendingTaskId,
  onSelectTask,
  onStatusChange,
}: TaskBoardLaneProps) {
  const { t } = useI18n()
  const [isDragOver, setIsDragOver] = useState(false)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAddingCard, setIsAddingCard] = useState(false)
  const [newCardTitle, setNewCardTitle] = useState('')
  const [isCreatingCard, setIsCreatingCard] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const quickAddTextareaRef = useRef<HTMLTextAreaElement>(null)
  const { createTaskMutation } = useTaskMutations()

  // Close menu on outside click or Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false)
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

  // Focus textarea when quick add opens
  useEffect(() => {
    if (isAddingCard) {
      quickAddTextareaRef.current?.focus()
      quickAddTextareaRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isAddingCard])

  const queryInput: TaskBoardLaneQueryInput = {
    lane,
    view: currentView,
    search: params.search,
    priority: params.priority,
    categoryId: params.categoryId,
    dueFrom: params.dueFrom,
    dueTo: params.dueTo,
    completedFrom: params.completedFrom,
    completedTo: params.completedTo,
    statusFilter: params.status,
    sort: params.sort,
    scope: params.scope,
    timeZone,
    now,
    pageSize: 30,
  }

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useTaskBoardLane(queryInput)

  const allItems: Task[] = React.useMemo(() => {
    if (!data?.pages) return []
    return data.pages.flatMap((page) => page.items)
  }, [data])

  const total = data?.pages[0]?.total ?? 0

  // Drag and Drop handlers with dynamic card position calculation
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!isDragOver) setIsDragOver(true)

    const cardsContainer = e.currentTarget.querySelector('.task-board-cards-list')
    if (cardsContainer) {
      const cardElements = Array.from(cardsContainer.querySelectorAll('.task-board-card'))
      if (cardElements.length === 0) {
        setDropIndex(0)
        return
      }

      let closestIndex = cardElements.length
      for (let i = 0; i < cardElements.length; i++) {
        const rect = cardElements[i].getBoundingClientRect()
        const midY = rect.top + rect.height / 2
        if (e.clientY < midY) {
          closestIndex = i
          break
        }
      }
      setDropIndex(closestIndex)
    } else {
      setDropIndex(allItems.length)
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only clear if leaving the lane container itself
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragOver(false)
    setDropIndex(null)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    setDropIndex(null)

    try {
      const rawData = e.dataTransfer.getData('application/json')
      const fallbackId = e.dataTransfer.getData('text/plain')

      let task: Task | undefined
      let taskId = fallbackId
      let currentStatus: TaskStatus | undefined

      if (rawData) {
        const parsed = JSON.parse(rawData)
        if (parsed && typeof parsed === 'object') {
          task = parsed as Task
          taskId = task.id
          currentStatus = task.status
        }
      }

      if (!taskId) return

      const targetPos = dropIndex ?? allItems.length

      if (currentStatus === lane) {
        // Reordering in same lane
        const sourceIndex = allItems.findIndex((t) => t.id === taskId)
        if (sourceIndex === -1) return

        let targetIndex = targetPos
        if (targetPos > sourceIndex) {
          targetIndex = targetPos - 1
        }
        if (targetIndex === sourceIndex) return

        const itemsWithoutMoved = allItems.filter((t) => t.id !== taskId)
        const targetTask = allItems[sourceIndex]
        const newBoardOrder = calculateNewBoardOrder(itemsWithoutMoved, targetIndex)

        onStatusChange(targetTask, lane, newBoardOrder)
        return
      }

      // Moving from a different lane
      const itemsWithoutMoved = allItems.filter((t) => t.id !== taskId)
      const targetIndex = Math.min(targetPos, itemsWithoutMoved.length)
      const newBoardOrder = calculateNewBoardOrder(itemsWithoutMoved, targetIndex)

      if (!task) {
        task = allItems.find((t) => t.id === taskId) || ({
          id: taskId,
          status: currentStatus || 'todo',
        } as Task)
      }

      onStatusChange(task, lane, newBoardOrder)
    } catch {
      // Ignore invalid drag payload
    }
  }

  // Quick add submit handler
  const handleQuickAddSubmit = async () => {
    const trimmed = newCardTitle.trim()
    if (!trimmed || isCreatingCard) return

    setIsCreatingCard(true)
    try {
      await createTaskMutation.mutateAsync({
        title: trimmed,
        status: lane,
        ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      })
      setNewCardTitle('')
      // Maintain focus for continuous fast card entry
      setTimeout(() => {
        quickAddTextareaRef.current?.focus()
      }, 50)
    } catch {
      // Keep title on error
    } finally {
      setIsCreatingCard(false)
    }
  }

  return (
    <div
      id={`lane-panel-${lane}`}
      role="tabpanel"
      aria-labelledby={`lane-tab-${lane}`}
      className={`task-board-lane task-board-lane--${lane} ${
        isMobileActive ? 'mobile-visible' : 'mobile-hidden'
      } ${isDragOver ? 'task-board-lane--dragover' : ''}`}
      data-testid={`task-board-lane-${lane}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Lane Header */}
      <div className="task-board-lane-header">
        <div className="task-board-lane-header-left">
          <span className={`task-board-lane-dot task-board-lane-dot--${lane}`} />
          <h3 className="task-board-lane-title">{title}</h3>
        </div>

        <div className="task-board-lane-header-right">
          {/* Total card count only (e.g. 10 instead of 10/10) */}
          <span
            className="task-board-lane-count-badge"
            aria-label={`${total} công việc`}
            data-testid={`lane-count-${lane}`}
          >
            {total}
          </span>

          {/* Three-dots column options dropdown menu */}
          <div className="task-board-lane-menu-anchor" ref={menuRef}>
            <button
              type="button"
              className="task-board-lane-menu-btn"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-expanded={isMenuOpen}
              aria-haspopup="menu"
              title="Tùy chọn cột"
              data-testid={`lane-menu-btn-${lane}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>

            {isMenuOpen && (
              <div
                className="task-board-lane-dropdown-menu"
                role="menu"
                data-testid={`lane-menu-dropdown-${lane}`}
              >
                <div className="lane-dropdown-menu-header">
                  <span className="lane-dropdown-title">Tùy chọn cột</span>
                  <button
                    type="button"
                    className="lane-dropdown-close-btn"
                    onClick={() => setIsMenuOpen(false)}
                    aria-label="Đóng tùy chọn"
                  >
                    &times;
                  </button>
                </div>

                <div className="lane-dropdown-menu-body">
                  <button
                    type="button"
                    className="lane-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setIsMenuOpen(false)
                      setIsAddingCard(true)
                    }}
                    data-testid={`lane-menu-add-card-${lane}`}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>Thêm công việc</span>
                  </button>

                  <button
                    type="button"
                    className="lane-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setIsMenuOpen(false)
                      refetch()
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M23 4v6h-6" />
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                    <span>Làm mới danh sách</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lane Content */}
      <div className="task-board-lane-body">
        {isLoading ? (
          <div className="task-board-lane-loading" data-testid={`lane-loading-${lane}`}>
            <div className="loading-spinner" />
            <span>{t('common.loading')}</span>
          </div>
        ) : isError ? (
          <div className="task-board-lane-error">
            <p>Không thể tải danh sách</p>
            <button
              type="button"
              className="btn-ghost-sm"
              onClick={() => refetch()}
            >
              {t('common.retry')}
            </button>
          </div>
        ) : allItems.length === 0 ? (
          <div className="task-board-lane-empty" data-testid={`lane-empty-${lane}`}>
            {isDragOver ? (
              <div
                className={`task-board-drop-placeholder task-board-drop-placeholder--${lane}`}
                data-testid="task-drop-placeholder"
              >
                <div className="drop-placeholder-inner">
                  <span className="drop-placeholder-dot" />
                  <span className="drop-placeholder-text">Thả công việc vào đây</span>
                </div>
              </div>
            ) : (
              <p>{t('tasks.laneEmpty')}</p>
            )}
          </div>
        ) : (
          <div className="task-board-cards-list">
            {allItems.map((task, index) => (
              <React.Fragment key={task.id}>
                {isDragOver && dropIndex === index && (
                  <div
                    className={`task-board-drop-placeholder task-board-drop-placeholder--${lane}`}
                    data-testid="task-drop-placeholder"
                  >
                    <div className="drop-placeholder-inner">
                      <span className="drop-placeholder-dot" />
                      <span className="drop-placeholder-text">Thả công việc vào đây</span>
                    </div>
                  </div>
                )}
                <TaskBoardCard
                  task={task}
                  onSelect={onSelectTask}
                  onStatusChange={onStatusChange}
                  isPending={pendingTaskId === task.id}
                />
              </React.Fragment>
            ))}

            {isDragOver && (dropIndex === null || dropIndex >= allItems.length) && (
              <div
                className={`task-board-drop-placeholder task-board-drop-placeholder--${lane}`}
                data-testid="task-drop-placeholder"
              >
                <div className="drop-placeholder-inner">
                  <span className="drop-placeholder-dot" />
                  <span className="drop-placeholder-text">Thả công việc vào đây</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Load More Button */}
        {hasNextPage && (
          <div className="task-board-lane-load-more">
            <button
              type="button"
              className="dashboard-action-btn w-full"
              disabled={isFetchingNextPage}
              onClick={() => fetchNextPage()}
              data-testid={`load-more-${lane}`}
            >
              {isFetchingNextPage ? t('tasks.loadingMore') : t('tasks.loadMore')}
            </button>
          </div>
        )}

        {/* Quick Add Card at the bottom of the column */}
        <div className="task-board-lane-footer">
          {isAddingCard ? (
            <div className="task-board-quick-add-form" data-testid={`quick-add-form-${lane}`}>
              <textarea
                ref={quickAddTextareaRef}
                className="task-board-quick-add-textarea"
                placeholder="Nhập tiêu đề công việc..."
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleQuickAddSubmit()
                  } else if (e.key === 'Escape') {
                    setIsAddingCard(false)
                    setNewCardTitle('')
                  }
                }}
                disabled={isCreatingCard}
                rows={2}
                autoFocus
                aria-label={`Thêm công việc vào cột ${title}`}
                data-testid={`quick-add-input-${lane}`}
              />
              <div className="task-board-quick-add-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm btn-quick-add-submit"
                  onClick={handleQuickAddSubmit}
                  disabled={isCreatingCard || !newCardTitle.trim()}
                  data-testid={`quick-add-submit-${lane}`}
                >
                  {isCreatingCard ? 'Đang thêm...' : 'Thêm công việc'}
                </button>
                <button
                  type="button"
                  className="btn-quick-add-cancel"
                  onClick={() => {
                    setIsAddingCard(false)
                    setNewCardTitle('')
                  }}
                  title="Hủy"
                  aria-label="Hủy"
                  disabled={isCreatingCard}
                  data-testid={`quick-add-cancel-${lane}`}
                >
                  &times;
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="task-board-quick-add-btn"
              onClick={() => setIsAddingCard(true)}
              data-testid={`quick-add-trigger-${lane}`}
              title={`Thêm công việc vào cột ${title}`}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Thêm công việc</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
