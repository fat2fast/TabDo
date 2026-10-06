import React, { useMemo, useState } from 'react'
import type { TaskChecklistItem } from '../utils/task-checklist'

export type { TaskChecklistItem }

export interface ChecklistItem {
  id: string
  lineIndex?: number
  text: string
  completed: boolean
}

export interface TaskChecklistProps {
  items?: TaskChecklistItem[]
  onChangeItems?: (newItems: TaskChecklistItem[]) => void
  description?: string
  onChangeDescription?: (newDesc: string) => void
  disabled?: boolean
}

export function TaskChecklist({
  items: directItems,
  onChangeItems,
  description,
  onChangeDescription,
  disabled = false,
}: TaskChecklistProps) {
  const [newItemText, setNewItemText] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  // Parse items either from directItems or legacy description lines
  const { items, completedCount, totalCount, percent } = useMemo(() => {
    if (directItems !== undefined) {
      const completed = directItems.filter((i) => i.completed).length
      const total = directItems.length
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0
      return {
        items: directItems.map((i) => ({ ...i, lineIndex: 0 })),
        completedCount: completed,
        totalCount: total,
        percent: pct,
      }
    }

    // Legacy fallback from description
    const lines = (description || '').split('\n')
    const list: ChecklistItem[] = []

    lines.forEach((line, index) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('- [ ] ')) {
        list.push({
          id: `chk-${index}`,
          lineIndex: index,
          text: trimmed.slice(6),
          completed: false,
        })
      } else if (trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')) {
        list.push({
          id: `chk-${index}`,
          lineIndex: index,
          text: trimmed.slice(6),
          completed: true,
        })
      }
    })

    const completed = list.filter((i) => i.completed).length
    const total = list.length
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0

    return {
      items: list,
      completedCount: completed,
      totalCount: total,
      percent: pct,
    }
  }, [directItems, description])

  // Toggle item completed state
  const handleToggleItem = (item: ChecklistItem) => {
    if (disabled) return

    if (directItems !== undefined && onChangeItems) {
      const updated = directItems.map((i) =>
        i.id === item.id ? { ...i, completed: !i.completed } : i
      )
      onChangeItems(updated)
      return
    }

    // Legacy description fallback
    if (description !== undefined && onChangeDescription && item.lineIndex !== undefined) {
      const lines = description.split('\n')
      const line = lines[item.lineIndex]
      if (!line) return

      const content = item.completed
        ? line.replace(/-\s*\[[xX]\]\s*/, '- [ ] ')
        : line.replace(/-\s*\[\s*\]\s*/, '- [x] ')

      lines[item.lineIndex] = content
      onChangeDescription(lines.join('\n'))
    }
  }

  // Delete item
  const handleDeleteItem = (item: ChecklistItem) => {
    if (disabled) return

    if (directItems !== undefined && onChangeItems) {
      const updated = directItems.filter((i) => i.id !== item.id)
      onChangeItems(updated)
      return
    }

    // Legacy description fallback
    if (description !== undefined && onChangeDescription && item.lineIndex !== undefined) {
      const lines = description.split('\n')
      lines.splice(item.lineIndex, 1)

      const remainingChecklist = lines.filter((l) => l.trim().startsWith('- [ ] ') || l.trim().startsWith('- [x] '))
      if (remainingChecklist.length === 0) {
        const cleaned = lines.filter((l) => l.trim() !== '### Checklist')
        onChangeDescription(cleaned.join('\n').trim())
        return
      }

      onChangeDescription(lines.join('\n'))
    }
  }

  // Add new checklist item
  const handleAddItem = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    const trimmed = newItemText.trim()
    if (!trimmed || disabled) return

    if (directItems !== undefined && onChangeItems) {
      const newItem: TaskChecklistItem = {
        id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text: trimmed,
        completed: false,
      }
      onChangeItems([...directItems, newItem])
      setNewItemText('')
      setIsAdding(false)
      return
    }

    // Legacy description fallback
    if (description !== undefined && onChangeDescription) {
      let newDesc = description.trim()
      const hasChecklistHeader = /###\s*Checklist/i.test(newDesc)

      if (totalCount === 0 && !hasChecklistHeader) {
        if (newDesc) {
          newDesc += `\n\n### Checklist\n- [ ] ${trimmed}`
        } else {
          newDesc = `### Checklist\n- [ ] ${trimmed}`
        }
      } else {
        newDesc += `\n- [ ] ${trimmed}`
      }

      onChangeDescription(newDesc)
      setNewItemText('')
      setIsAdding(false)
    }
  }

  return (
    <div className="task-checklist-widget" data-testid="task-checklist-widget">
      <div className="checklist-widget-header">
        <div className="checklist-title-group">
          <span className="checklist-icon">☑</span>
          <h4 className="checklist-title">Checklist</h4>
          {totalCount > 0 && (
            <span className="checklist-counter-badge">
              {completedCount}/{totalCount} ({percent}%)
            </span>
          )}
        </div>

        {!isAdding && (
          <button
            type="button"
            className="btn-add-checklist-item"
            onClick={() => setIsAdding(true)}
            disabled={disabled}
          >
            + Thêm mục
          </button>
        )}
      </div>

      {/* Progress Bar */}
      {totalCount > 0 && (
        <div className="checklist-progress-track">
          <div
            className="checklist-progress-bar"
            style={{ width: `${percent}%` }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      )}

      {/* Checklist items list */}
      {items.length > 0 ? (
        <ul className="checklist-items-list">
          {items.map((item) => (
            <li
              key={item.id}
              className={`checklist-item-row ${item.completed ? 'completed' : ''}`}
            >
              <label className="checklist-item-label">
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => handleToggleItem(item)}
                  disabled={disabled}
                  className="checklist-native-checkbox"
                />
                <span className="checklist-custom-check">
                  {item.completed && <span className="check-tick">✓</span>}
                </span>
                <span className={`checklist-item-text ${item.completed ? 'line-through' : ''}`}>
                  {item.text}
                </span>
              </label>

              <button
                type="button"
                className="checklist-item-delete"
                onClick={() => handleDeleteItem(item)}
                disabled={disabled}
                title="Xóa mục này"
                aria-label={`Xóa mục: ${item.text}`}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !isAdding && (
          <div className="checklist-empty-hint">
            <span>Chưa có mục checklist nào. Bấm <strong>+ Thêm mục</strong> để chia nhỏ tiến độ.</span>
          </div>
        )
      )}

      {/* Inline Add Item Form */}
      {isAdding && (
        <div className="checklist-add-form">
          <input
            type="text"
            placeholder="Nhập nội dung mục kiểm tra..."
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation()
                handleAddItem()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setIsAdding(false)
                setNewItemText('')
              }
            }}
            disabled={disabled}
            className="checklist-add-input"
            autoFocus
          />
          <div className="checklist-add-actions">
            <button
              type="button"
              className="btn-primary btn-chk-save"
              onClick={(e) => handleAddItem(e)}
              disabled={disabled || !newItemText.trim()}
            >
              Thêm
            </button>
            <button
              type="button"
              className="btn-secondary btn-chk-cancel"
              onClick={() => {
                setIsAdding(false)
                setNewItemText('')
              }}
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
