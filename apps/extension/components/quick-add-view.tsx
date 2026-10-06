import React, { useState } from 'react'

interface QuickAddViewProps {
  onAdd: (title: string) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  error?: string | null
}

export function QuickAddView({
  onAdd,
  onCancel,
  isLoading = false,
  error = null,
}: QuickAddViewProps) {
  const [title, setTitle] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    const trimmed = title.trim()
    if (!trimmed) {
      setValidationError('Tiêu đề công việc không được để trống')
      return
    }
    if (trimmed.length > 500) {
      setValidationError('Tiêu đề công việc không được vượt quá 500 ký tự')
      return
    }

    try {
      await onAdd(trimmed)
      setTitle('')
    } catch {
      // Error handled by parent or displayed via error prop
    }
  }

  const displayedError = validationError || error

  return (
    <div className="tabdo-view quick-add-view">
      <div className="tabdo-header">
        <div className="tabdo-header-row">
          <h2 className="tabdo-view-title">Thêm công việc nhanh</h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="tabdo-btn tabdo-btn-ghost tabdo-btn-sm"
          >
            Hủy
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="tabdo-form" noValidate>
        {displayedError && (
          <div className="tabdo-alert tabdo-alert-danger" role="alert">
            {displayedError}
          </div>
        )}

        <div className="tabdo-field">
          <label htmlFor="quick-add-title" className="tabdo-label">
            Tiêu đề công việc
          </label>
          <input
            id="quick-add-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Bạn cần làm gì?"
            disabled={isLoading}
            autoFocus
            className="tabdo-input"
          />
        </div>

        <div className="tabdo-form-actions">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="tabdo-btn tabdo-btn-secondary"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="tabdo-btn tabdo-btn-primary"
          >
            {isLoading ? 'Đang lưu...' : 'Thêm việc'}
          </button>
        </div>
      </form>
    </div>
  )
}
