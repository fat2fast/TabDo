import React, { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  createTaskLinkAttachment,
  deleteTaskAttachment,
  downloadAndOpenAttachment,
  uploadTaskAttachment,
} from '../api/tasks'
import { taskQueryKeys } from '../query-keys'
import { formatFileSize, type TaskAttachment } from '../utils/task-attachments'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
])

function isAllowedFile(file: File): boolean {
  if (ALLOWED_MIME_TYPES.has(file.type)) return true
  const ext = file.name.split('.').pop()?.toLowerCase()
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'pdf', 'txt', 'md', 'csv', 'json'].includes(ext || '')
}

function useSafeQueryClient() {
  try {
    return useQueryClient()
  } catch {
    return null
  }
}

export interface TaskAttachmentsProps {
  taskId?: string
  attachments: TaskAttachment[]
  onChangeAttachments?: (newAttachments: TaskAttachment[]) => void
  disabled?: boolean
}

export function TaskAttachments({
  taskId,
  attachments = [],
  onChangeAttachments,
  disabled = false,
}: TaskAttachmentsProps) {
  const queryClient = useSafeQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isAddingLink, setIsAddingLink] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkName, setLinkName] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const processFileList = async (files: FileList | File[]) => {
    setErrorMsg(null)
    if (!files || files.length === 0 || disabled) return

    const newItems: TaskAttachment[] = []
    const maxBytes = 10 * 1024 * 1024 // 10MB

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Guard file size (max 10MB per file)
      if (file.size > maxBytes) {
        setErrorMsg(`Tệp "${file.name}" vượt quá kích thước cho phép (tối đa 10MB).`)
        continue
      }

      // Guard MIME type
      if (!isAllowedFile(file)) {
        setErrorMsg(
          `Định dạng tệp "${file.name}" không được hỗ trợ. Chỉ chấp nhận hình ảnh, PDF, tài liệu văn bản (TXT, MD, CSV, JSON).`
        )
        continue
      }

      if (taskId) {
        // Direct upload to Supabase Storage + task_attachments table
        try {
          setIsUploading(true)
          const uploaded = await uploadTaskAttachment(taskId, file)
          newItems.push(uploaded)
        } catch (err: any) {
          setErrorMsg(err?.message || `Không thể tải lên tệp "${file.name}".`)
        } finally {
          setIsUploading(false)
        }
      } else {
        // Staged upload for new task draft without Base64 conversion
        const isImage = file.type.startsWith('image/')
        const previewUrl = isImage && typeof URL !== 'undefined' ? URL.createObjectURL(file) : undefined
        newItems.push({
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          url: previewUrl,
          kind: 'file',
          rawFile: file,
          createdAt: new Date().toISOString(),
        } as any)
      }
    }

    if (newItems.length > 0) {
      if (taskId && queryClient) {
        queryClient.invalidateQueries({ queryKey: taskQueryKeys.attachments(taskId) })
      }
      if (onChangeAttachments) {
        onChangeAttachments([...attachments, ...newItems])
      }
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

  const handleAddLink = async (e?: React.SyntheticEvent) => {
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

    if (taskId) {
      try {
        const createdLink = await createTaskLinkAttachment(taskId, resolvedName, trimmedUrl)
        queryClient?.invalidateQueries({ queryKey: taskQueryKeys.attachments(taskId) })
        if (onChangeAttachments) {
          onChangeAttachments([...attachments, createdLink])
        }
        setLinkUrl('')
        setLinkName('')
        setIsAddingLink(false)
      } catch (err: any) {
        setErrorMsg(err?.message || 'Không thể thêm liên kết.')
      }
    } else {
      const newAttachment: TaskAttachment = {
        id: `att-link-${Date.now()}`,
        name: resolvedName,
        size: 0,
        type: 'link',
        kind: 'link',
        url: trimmedUrl,
        externalUrl: trimmedUrl,
        createdAt: new Date().toISOString(),
      }

      if (onChangeAttachments) {
        onChangeAttachments([...attachments, newAttachment])
      }
      setLinkUrl('')
      setLinkName('')
      setIsAddingLink(false)
    }
  }

  const handleDeleteAttachment = async (target: TaskAttachment) => {
    if (disabled) return
    if (taskId && target.id && target.kind) {
      try {
        await deleteTaskAttachment(target)
        queryClient?.invalidateQueries({ queryKey: taskQueryKeys.attachments(taskId) })
      } catch (err: any) {
        console.warn('[handleDeleteAttachment] error:', err)
      }
    }
    if (onChangeAttachments) {
      onChangeAttachments(attachments.filter((item) => item.id !== target.id))
    }
  }

  const handleOpenOrDownload = async (att: TaskAttachment) => {
    try {
      setDownloadingId(att.id)
      await downloadAndOpenAttachment(att)
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể mở hoặc tải xuống tệp.')
    } finally {
      setDownloadingId(null)
    }
  }

  const getFileIcon = (att: TaskAttachment) => {
    if (att.kind === 'link' || att.type === 'link') return '🔗'
    const typeStr = att.type || ''
    if (typeStr.startsWith('image/')) return '🖼️'
    if (typeStr.includes('pdf')) return '📕'
    if (typeStr.includes('word') || att.name.endsWith('.doc') || att.name.endsWith('.docx')) return '📘'
    if (typeStr.includes('sheet') || att.name.endsWith('.xls') || att.name.endsWith('.xlsx')) return '📗'
    if (typeStr.includes('zip') || att.name.endsWith('.zip')) return '📦'
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
            disabled={disabled || isUploading}
            title="Tải tệp từ máy tính"
          >
            {isUploading ? 'Đang tải...' : '+ Chọn tệp'}
          </button>
          <button
            type="button"
            className="btn-link-attachment"
            onClick={() => setIsAddingLink(!isAddingLink)}
            disabled={disabled || isUploading}
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
        disabled={disabled || isUploading}
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
            const isImage = (att.type || '').startsWith('image/')
            const previewUrl = att.url
            return (
              <div key={att.id} className="attachment-card">
                <div className="card-file-preview">
                  {isImage && previewUrl ? (
                    <img src={previewUrl} alt={att.name} className="img-thumbnail" />
                  ) : (
                    <span className="file-icon">{getFileIcon(att)}</span>
                  )}
                </div>

                <div className="card-file-info">
                  <span className="card-file-name" title={att.name}>
                    {att.name}
                  </span>
                  <span className="card-file-sub">
                    {(att.size || 0) > 0
                      ? formatFileSize(att.size)
                      : 'Liên kết ngoài'}
                  </span>
                </div>

                <div className="card-file-actions">
                  <button
                    type="button"
                    onClick={() => handleOpenOrDownload(att)}
                    className="attachment-view-link"
                    title="Mở hoặc tải về"
                    disabled={downloadingId === att.id}
                  >
                    {downloadingId === att.id ? '...' : 'Mở ↗'}
                  </button>
                  <button
                    type="button"
                    className="attachment-delete-btn"
                    onClick={() => handleDeleteAttachment(att)}
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
