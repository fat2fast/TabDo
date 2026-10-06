import React, { useRef, useState } from 'react'
import { formatFileSize, type TaskAttachment } from '../utils/task-attachments'

export interface TaskAttachmentsProps {
  attachments: TaskAttachment[]
  onChangeAttachments: (newAttachments: TaskAttachment[]) => void
  disabled?: boolean
}

export function TaskAttachments({
  attachments,
  onChangeAttachments,
  disabled = false,
}: TaskAttachmentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isAddingLink, setIsAddingLink] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkName, setLinkName] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const processFileList = async (files: FileList | File[]) => {
    setErrorMsg(null)
    if (!files || files.length === 0 || disabled) return

    const newItems: TaskAttachment[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Guard file size (max 4MB per file for base64 storage)
      if (file.size > 4 * 1024 * 1024) {
        setErrorMsg(`Tệp "${file.name}" vượt quá kích thước cho phép (tối đa 4MB).`)
        continue
      }

      try {
        const dataUrl = await readFileAsDataUrl(file)
        newItems.push({
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          url: dataUrl,
          createdAt: new Date().toISOString(),
        })
      } catch {
        setErrorMsg(`Không thể đọc tệp "${file.name}".`)
      }
    }

    if (newItems.length > 0) {
      onChangeAttachments([...attachments, ...newItems])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFileList(e.target.files)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDraggingOver(true)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDraggingOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
    if (disabled) return
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      processFileList(files)
    }
  }

  const handleAddLink = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setErrorMsg(null)
    const trimmedUrl = linkUrl.trim()
    if (!trimmedUrl || disabled) return

    let resolvedName = linkName.trim()
    if (!resolvedName) {
      try {
        const parsed = new URL(trimmedUrl)
        resolvedName = parsed.hostname + (parsed.pathname.length > 1 ? parsed.pathname.slice(0, 20) : '')
      } catch {
        resolvedName = trimmedUrl.slice(0, 30)
      }
    }

    const newAttachment: TaskAttachment = {
      id: `att-link-${Date.now()}`,
      name: resolvedName,
      size: 0,
      type: 'link',
      url: trimmedUrl,
      createdAt: new Date().toISOString(),
    }

    onChangeAttachments([...attachments, newAttachment])
    setLinkUrl('')
    setLinkName('')
    setIsAddingLink(false)
  }

  const handleDeleteAttachment = (id: string) => {
    if (disabled) return
    onChangeAttachments(attachments.filter((item) => item.id !== id))
  }

  const getFileIcon = (att: TaskAttachment) => {
    if (att.type === 'link') return '🔗'
    if (att.type.startsWith('image/')) return '🖼️'
    if (att.type.includes('pdf')) return '📕'
    if (att.type.includes('word') || att.name.endsWith('.doc') || att.name.endsWith('.docx')) return '📘'
    if (att.type.includes('sheet') || att.name.endsWith('.xls') || att.name.endsWith('.xlsx')) return '📗'
    if (att.type.includes('zip') || att.type.includes('rar') || att.name.endsWith('.7z')) return '📦'
    return '📄'
  }

  return (
    <div className="task-attachments-widget" data-testid="task-attachments-widget">
      <div className="attachments-header">
        <div className="attachments-title-group">
          <span className="attachments-icon">📎</span>
          <h4 className="attachments-title">Tệp đính kèm</h4>
          {attachments.length > 0 && (
            <span className="attachments-counter-badge">{attachments.length}</span>
          )}
        </div>

        <div className="attachments-header-actions">
          <button
            type="button"
            className="btn-upload-attachment"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            title="Tải tệp từ máy tính"
          >
            + Chọn tệp
          </button>
          <button
            type="button"
            className="btn-link-attachment"
            onClick={() => setIsAddingLink(!isAddingLink)}
            disabled={disabled}
            title="Thêm liên kết tài liệu trực tuyến"
          >
            {isAddingLink ? 'Đóng link' : '+ Thêm link'}
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileSelect}
        disabled={disabled}
      />

      {errorMsg && (
        <div className="attachments-error" role="alert">
          {errorMsg}
        </div>
      )}

      {/* Drag & Drop Zone */}
      <div
        className={`attachments-dropzone ${isDraggingOver ? 'dragging-over' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
      >
        <div className="dropzone-content">
          <svg className="dropzone-icon" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <div className="dropzone-text">
            {isDraggingOver ? (
              <span className="dropzone-prompt active">Thả tệp vào đây để tải lên ngay!</span>
            ) : (
              <>
                <span className="dropzone-prompt">
                  <strong>Kéo và thả tệp vào đây</strong>, hoặc <u>chọn từ máy tính</u>
                </span>
                <span className="dropzone-hint">Hình ảnh, PDF, Word, Excel, ZIP (tối đa 4MB)</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Inline Link Input */}
      {isAddingLink && (
        <div className="attachments-link-form">
          <div className="link-form-inputs">
            <input
              type="url"
              placeholder="https://drive.google.com/... hoặc link tài liệu"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="link-input"
              autoFocus
            />
            <input
              type="text"
              placeholder="Tên gợi nhớ (tùy chọn)"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              className="link-name-input"
            />
          </div>
          <div className="link-form-buttons">
            <button
              type="button"
              className="btn-primary btn-link-save"
              onClick={handleAddLink}
              disabled={disabled || !linkUrl.trim()}
            >
              Gắn link
            </button>
            <button
              type="button"
              className="btn-secondary btn-link-cancel"
              onClick={() => {
                setIsAddingLink(false)
                setLinkUrl('')
                setLinkName('')
              }}
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="attachments-grid">
          {attachments.map((att) => {
            const isImage = att.type.startsWith('image/')
            return (
              <div key={att.id} className="attachment-card">
                <div className="card-file-preview">
                  {isImage && att.url.startsWith('data:') ? (
                    <img src={att.url} alt={att.name} className="img-thumbnail" />
                  ) : (
                    <span className="file-icon">{getFileIcon(att)}</span>
                  )}
                </div>

                <div className="card-file-info">
                  <span className="card-file-name" title={att.name}>
                    {att.name}
                  </span>
                  <span className="card-file-sub">
                    {att.size > 0 ? formatFileSize(att.size) : 'Liên kết ngoài'}
                  </span>
                </div>

                <div className="card-file-actions">
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={att.type !== 'link' ? att.name : undefined}
                    className="attachment-view-link"
                    title="Mở hoặc tải về"
                  >
                    Mở ↗
                  </a>
                  <button
                    type="button"
                    className="attachment-delete-btn"
                    onClick={() => handleDeleteAttachment(att.id)}
                    disabled={disabled}
                    title="Xóa tệp đính kèm này"
                    aria-label={`Xóa tệp: ${att.name}`}
                  >
                    &times;
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
