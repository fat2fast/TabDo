import React, { useState } from 'react'
import {
  useCategoryRelatedTasks,
  useLinkedTasks,
  useSiblingTasks,
  useTaskCandidates,
} from '../hooks/use-tasks'
import type { Task } from '../types'

export interface RelatedTasksProps {
  currentTask?: Task | null
  linkedTaskIds: string[]
  onUpdateLinkedTaskIds: (newIds: string[]) => void
  onSelectTask?: (taskId: string) => void
  disabled?: boolean
}

export function RelatedTasks({
  currentTask,
  linkedTaskIds,
  onUpdateLinkedTaskIds,
  onSelectTask,
  disabled = false,
}: RelatedTasksProps) {
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // 1. Fetch directly linked tasks
  const { data: linkedTasks = [], isLoading: loadingLinked } = useLinkedTasks(linkedTaskIds)

  // 2. Fetch sibling tasks (if current task is a subtask)
  const { data: siblingTasks = [] } = useSiblingTasks(currentTask?.parentId, currentTask?.id || '')

  // 3. Fetch related tasks in the same category
  const { data: categoryTasks = [] } = useCategoryRelatedTasks(currentTask?.categoryId, currentTask?.id || '')

  // 4. Candidates for searching and linking
  const { data: candidates = [], isLoading: loadingCandidates } = useTaskCandidates(
    currentTask?.id,
    searchQuery,
    showSearchModal
  )

  const handleLinkTask = (taskId: string) => {
    if (disabled) return
    if (!linkedTaskIds.includes(taskId)) {
      onUpdateLinkedTaskIds([...linkedTaskIds, taskId])
    }
  }

  const handleUnlinkTask = (taskId: string) => {
    if (disabled) return
    onUpdateLinkedTaskIds(linkedTaskIds.filter((id) => id !== taskId))
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'done':
        return <span className="related-status-tag status-done">Hoàn thành</span>
      case 'in_progress':
        return <span className="related-status-tag status-in-progress">Đang làm</span>
      default:
        return <span className="related-status-tag status-todo">Cần làm</span>
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <span className="related-priority-dot high" title="Ưu tiên cao" />
      case 'medium':
        return <span className="related-priority-dot medium" title="Ưu tiên trung bình" />
      default:
        return <span className="related-priority-dot low" title="Ưu tiên thấp" />
    }
  }

  return (
    <div className="related-tasks-section" data-testid="related-tasks-section">
      <div className="related-tasks-header">
        <div className="header-title-box">
          <span className="related-icon">🔗</span>
          <h4 className="related-title">Công việc liên quan</h4>
          {linkedTaskIds.length > 0 && (
            <span className="related-count-badge">{linkedTaskIds.length}</span>
          )}
        </div>
        <button
          type="button"
          className="btn-add-related-link"
          onClick={() => setShowSearchModal(true)}
          disabled={disabled}
        >
          + Liên kết công việc
        </button>
      </div>

      {/* 1. Directly Linked Tasks */}
      <div className="related-subsection">
        <span className="subsection-label">Liên kết trực tiếp</span>
        {loadingLinked ? (
          <div className="related-loading">Đang tải công việc đã liên kết...</div>
        ) : linkedTasks.length > 0 ? (
          <div className="related-cards-grid">
            {linkedTasks.map((t) => (
              <div key={t.id} className="related-task-card">
                <div className="card-top-row">
                  {getPriorityBadge(t.priority)}
                  <span className="related-task-title" title={t.title}>
                    {t.title}
                  </span>
                  {getStatusBadge(t.status)}
                </div>
                <div className="card-bottom-row">
                  {onSelectTask && (
                    <button
                      type="button"
                      className="related-action-btn view-btn"
                      onClick={() => onSelectTask(t.id)}
                      title="Xem chi tiết công việc này"
                    >
                      Mở xem &rarr;
                    </button>
                  )}
                  <button
                    type="button"
                    className="related-action-btn unlink-btn"
                    onClick={() => handleUnlinkTask(t.id)}
                    disabled={disabled}
                    title="Gỡ liên kết"
                  >
                    Gỡ liên kết
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="related-empty-note">
            Chưa có công việc nào được liên kết thủ công.
          </div>
        )}
      </div>

      {/* 2. Sibling Tasks (when this is a subtask) */}
      {currentTask?.parentId && siblingTasks.length > 0 && (
        <div className="related-subsection">
          <span className="subsection-label">Cùng công việc cha ({siblingTasks.length})</span>
          <div className="related-cards-grid">
            {siblingTasks.map((s) => (
              <div key={s.id} className="related-task-card sibling-card">
                <div className="card-top-row">
                  <span className="sibling-icon">↳</span>
                  <span className="related-task-title" title={s.title}>
                    {s.title}
                  </span>
                  {getStatusBadge(s.status)}
                </div>
                <div className="card-bottom-row">
                  {onSelectTask && (
                    <button
                      type="button"
                      className="related-action-btn view-btn"
                      onClick={() => onSelectTask(s.id)}
                    >
                      Chuyển sang &rarr;
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Category Related Suggestions */}
      {currentTask?.categoryId && categoryTasks.length > 0 && (
        <div className="related-subsection">
          <span className="subsection-label">Cùng danh mục đang mở ({categoryTasks.length})</span>
          <div className="related-chips-list">
            {categoryTasks.map((c) => (
              <div key={c.id} className="related-chip-item">
                <span className="chip-bullet">•</span>
                <span className="chip-title" title={c.title}>
                  {c.title}
                </span>
                {onSelectTask && (
                  <button
                    type="button"
                    className="chip-view-btn"
                    onClick={() => onSelectTask(c.id)}
                  >
                    Xem
                  </button>
                )}
                {!linkedTaskIds.includes(c.id) && (
                  <button
                    type="button"
                    className="chip-link-btn"
                    onClick={() => handleLinkTask(c.id)}
                    disabled={disabled}
                    title="Liên kết công việc này"
                  >
                    + Ghim
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Link Candidate Modal */}
      {showSearchModal && (
        <div className="related-search-backdrop" onClick={() => setShowSearchModal(false)}>
          <div
            className="related-search-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Chọn công việc để liên kết"
          >
            <div className="modal-header">
              <h4 className="modal-title">Liên kết công việc</h4>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowSearchModal(false)}
              >
                &times;
              </button>
            </div>

            <div className="modal-search-box">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm công việc theo tiêu đề..."
                className="related-search-input"
                autoFocus
              />
            </div>

            <div className="modal-candidates-list">
              {loadingCandidates ? (
                <div className="modal-loading-text">Đang tìm công việc...</div>
              ) : candidates.length === 0 ? (
                <div className="modal-empty-text">Không tìm thấy công việc phù hợp</div>
              ) : (
                candidates.map((cand) => {
                  const isLinked = linkedTaskIds.includes(cand.id)
                  return (
                    <div key={cand.id} className="candidate-row">
                      <div className="candidate-info">
                        {getPriorityBadge(cand.priority)}
                        <span className="candidate-title">{cand.title}</span>
                        {getStatusBadge(cand.status)}
                      </div>
                      <div className="candidate-action">
                        {isLinked ? (
                          <button
                            type="button"
                            className="btn-candidate-linked"
                            onClick={() => handleUnlinkTask(cand.id)}
                            disabled={disabled}
                          >
                            Đã liên kết ✓ (Hủy)
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-candidate-link"
                            onClick={() => handleLinkTask(cand.id)}
                            disabled={disabled}
                          >
                            + Liên kết
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
