import React, { useState } from 'react'
import { useCategories } from '../hooks/use-categories'
import { useTaskMutations } from '../hooks/use-task-mutations'
import type { Category } from '../types'

export interface CategoryManagerProps {
  isOpen: boolean
  onClose: () => void
}

const PRESET_COLORS = [
  '#0284c7', // Sky
  '#16a34a', // Green
  '#ca8a04', // Amber
  '#dc2626', // Red
  '#9333ea', // Purple
  '#ec4899', // Pink
  '#475569', // Slate
]

export function CategoryManager({ isOpen, onClose }: CategoryManagerProps) {
  const { data: categories = [], isLoading } = useCategories()
  const { createCategoryMutation, updateCategoryMutation, deleteCategoryMutation } =
    useTaskMutations()

  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isOpen) return null

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    const trimmed = newName.trim()
    if (!trimmed) {
      setErrorMsg('Tên danh mục không được để trống.')
      return
    }

    try {
      await createCategoryMutation.mutateAsync({
        name: trimmed,
        color: newColor,
      })
      setNewName('')
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể tạo danh mục.')
    }
  }

  const startEdit = (cat: Category) => {
    setEditingId(cat.id)
    setEditName(cat.name)
    setEditColor(cat.color || PRESET_COLORS[0])
    setErrorMsg(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditColor('')
  }

  const handleUpdate = async (id: string) => {
    setErrorMsg(null)
    const trimmed = editName.trim()
    if (!trimmed) {
      setErrorMsg('Tên danh mục không được để trống.')
      return
    }

    try {
      await updateCategoryMutation.mutateAsync({
        id,
        input: { name: trimmed, color: editColor },
      })
      cancelEdit()
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể cập nhật danh mục.')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa danh mục "${name}"? Các công việc thuộc danh mục này sẽ được chuyển thành "Không phân loại" và KHÔNG bị xóa.`
      )
    ) {
      return
    }

    try {
      await deleteCategoryMutation.mutateAsync(id)
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể xóa danh mục.')
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="category-manager-modal">
      <div
        className="modal-content card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="category-manager-title"
      >
        <div className="modal-header">
          <h3 id="category-manager-title">Quản lý danh mục</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        {errorMsg && (
          <div className="alert-error" role="alert">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleCreate} className="category-create-form">
          <div className="form-group">
            <label htmlFor="new-cat-name" className="category-section-label">Thêm danh mục mới:</label>
            <div className="category-input-group">
              <input
                id="new-cat-name"
                type="text"
                placeholder="Nhập tên danh mục (ví dụ: Công việc, Cá nhân...)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={createCategoryMutation.isPending}
                className="category-name-input"
              />
              <button
                type="submit"
                className="btn-primary category-add-btn"
                disabled={createCategoryMutation.isPending || !newName.trim()}
              >
                Thêm
              </button>
            </div>
            <div className="category-color-picker-row">
              <span className="color-picker-label">Màu sắc:</span>
              <div className="color-presets">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-dot-btn ${newColor === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewColor(color)}
                    aria-label={`Chọn màu ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </form>

        <div className="category-list-section">
          <h4 className="category-section-label">Danh sách danh mục ({categories.length})</h4>
          {isLoading ? (
            <div className="category-loading">Đang tải danh mục...</div>
          ) : categories.length === 0 ? (
            <div className="category-empty-state">
              <span className="empty-icon">📁</span>
              <p>Chưa có danh mục nào. Tạo danh mục phía trên để phân loại công việc dễ dàng hơn.</p>
            </div>
          ) : (
            <ul className="category-list">
              {categories.map((cat) => {
                const isEditing = editingId === cat.id
                return (
                  <li key={cat.id} className={`category-list-item ${isEditing ? 'editing' : ''}`}>
                    {isEditing ? (
                      <div className="category-edit-card">
                        <div className="category-edit-input-row">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="category-edit-input"
                            placeholder="Tên danh mục..."
                            autoFocus
                          />
                          <div className="category-edit-btns">
                            <button
                              type="button"
                              className="btn-primary btn-save-sm"
                              onClick={() => handleUpdate(cat.id)}
                            >
                              Lưu
                            </button>
                            <button type="button" className="btn-secondary btn-cancel-sm" onClick={cancelEdit}>
                              Hủy
                            </button>
                          </div>
                        </div>
                        <div className="category-edit-color-row">
                          <span className="color-picker-label">Đổi màu:</span>
                          <div className="color-presets">
                            {PRESET_COLORS.map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={`color-dot-btn ${editColor === color ? 'selected' : ''}`}
                                style={{ backgroundColor: color }}
                                onClick={() => setEditColor(color)}
                                aria-label={`Chọn màu ${color}`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="category-item-row">
                        <div className="category-item-info">
                          <span
                            className="category-color-indicator"
                            style={{ backgroundColor: cat.color || '#cbd5e1' }}
                          />
                          <span className="category-item-name">{cat.name}</span>
                        </div>
                        <div className="category-item-actions">
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => startEdit(cat)}
                            title="Sửa tên"
                            aria-label="Sửa danh mục"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="btn-icon-danger"
                            onClick={() => handleDelete(cat.id, cat.name)}
                            title="Xóa danh mục"
                            aria-label="Xóa danh mục"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
