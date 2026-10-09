import React, { useRef, useState } from 'react'
import { MarkdownViewer } from './markdown-viewer'

export interface MarkdownDescriptionEditorProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  id?: string
}

export function MarkdownDescriptionEditor({
  value,
  onChange,
  disabled = false,
  placeholder = 'Thêm mô tả chi tiết, ghi chú, liên kết (hỗ trợ Markdown)...',
  id = 'task-desc-input',
}: MarkdownDescriptionEditorProps) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Insert markdown syntax helper with heading preservation and toggle support
  const applyFormat = (prefix: string, suffix: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)

    // Separate leading/trailing whitespace to prevent malformed formatting
    const leadingWsMatch = selectedText.match(/^\s*/)
    const leadingWs = leadingWsMatch ? leadingWsMatch[0] : ''
    const trailingWsMatch = selectedText.match(/\s*$/)
    const trailingWs = trailingWsMatch ? trailingWsMatch[0] : ''
    const coreText = selectedText.substring(leadingWs.length, selectedText.length - trailingWs.length)

    let replacement = ''
    let newSelectionStart = start
    let newSelectionEnd = end

    if (!coreText) {
      // Nothing selected, insert default text wrapped
      replacement = `${prefix}${defaultText}${suffix}`
      newSelectionStart = start + prefix.length
      newSelectionEnd = newSelectionStart + defaultText.length
    } else {
      // Check if coreText is already wrapped in prefix & suffix (toggle off)
      const isAlreadyWrapped =
        coreText.startsWith(prefix) &&
        coreText.endsWith(suffix) &&
        coreText.length >= prefix.length + suffix.length

      if (isAlreadyWrapped && prefix.length > 0 && suffix.length > 0) {
        // Toggle OFF formatting
        const unwrapped = coreText.slice(prefix.length, coreText.length - suffix.length)
        replacement = `${leadingWs}${unwrapped}${trailingWs}`
        newSelectionStart = start + leadingWs.length
        newSelectionEnd = newSelectionStart + unwrapped.length
      } else {
        // Check if coreText contains a heading prefix like "### "
        const headingMatch = /^(#{1,6}\s+)(.*)$/s.exec(coreText)
        if (headingMatch && prefix === '**' && suffix === '**') {
          const hPrefix = headingMatch[1]
          const hContent = headingMatch[2]
          if (hContent.startsWith('**') && hContent.endsWith('**') && hContent.length >= 4) {
            // Already bold heading -> toggle off bold inside heading
            const unbolded = hContent.slice(2, -2)
            replacement = `${leadingWs}${hPrefix}${unbolded}${trailingWs}`
            newSelectionStart = start + leadingWs.length + hPrefix.length
            newSelectionEnd = newSelectionStart + unbolded.length
          } else {
            // Make content of heading bold: "### **heading content**"
            const bolded = `**${hContent || defaultText}**`
            replacement = `${leadingWs}${hPrefix}${bolded}${trailingWs}`
            newSelectionStart = start + leadingWs.length + hPrefix.length
            newSelectionEnd = newSelectionStart + bolded.length
          }
        } else if (headingMatch && prefix === '*' && suffix === '*') {
          const hPrefix = headingMatch[1]
          const hContent = headingMatch[2]
          if (hContent.startsWith('*') && hContent.endsWith('*') && hContent.length >= 2) {
            const unitalic = hContent.slice(1, -1)
            replacement = `${leadingWs}${hPrefix}${unitalic}${trailingWs}`
            newSelectionStart = start + leadingWs.length + hPrefix.length
            newSelectionEnd = newSelectionStart + unitalic.length
          } else {
            const italicized = `*${hContent || defaultText}*`
            replacement = `${leadingWs}${hPrefix}${italicized}${trailingWs}`
            newSelectionStart = start + leadingWs.length + hPrefix.length
            newSelectionEnd = newSelectionStart + italicized.length
          }
        } else {
          replacement = `${leadingWs}${prefix}${coreText}${suffix}${trailingWs}`
          newSelectionStart = start + leadingWs.length + prefix.length
          newSelectionEnd = newSelectionStart + coreText.length
        }
      }
    }

    const newValue = value.substring(0, start) + replacement + value.substring(end)
    onChange(newValue)

    // Re-focus and preserve accurate selection
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(newSelectionStart, newSelectionEnd)
    }, 0)
  }

  // Insert line prefix (e.g. for headings, lists)
  const insertLinePrefix = (prefix: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    // Find the start of the current line
    const lastNewline = value.lastIndexOf('\n', start - 1)
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1

    const lineRest = value.substring(lineStart)
    const nextNewline = lineRest.indexOf('\n')
    const currentLine = nextNewline === -1 ? lineRest : lineRest.substring(0, nextNewline)

    let newValue = ''
    let cursorOffset = prefix.length

    if (currentLine.startsWith(prefix)) {
      // Toggle off prefix if clicked again
      newValue =
        value.substring(0, lineStart) +
        currentLine.slice(prefix.length) +
        (nextNewline === -1 ? '' : value.substring(lineStart + nextNewline))
      cursorOffset = -prefix.length
    } else {
      // Replace existing heading prefix or add
      const existingHeading = /^(#{1,6}\s+)/.exec(currentLine)
      if (existingHeading) {
        const oldLen = existingHeading[1].length
        newValue =
          value.substring(0, lineStart) +
          prefix +
          currentLine.slice(oldLen) +
          (nextNewline === -1 ? '' : value.substring(lineStart + nextNewline))
        cursorOffset = prefix.length - oldLen
      } else {
        newValue =
          value.substring(0, lineStart) +
          prefix +
          value.substring(lineStart)
      }
    }

    onChange(newValue)

    setTimeout(() => {
      textarea.focus()
      const newPos = Math.max(lineStart, start + cursorOffset)
      textarea.setSelectionRange(newPos, newPos)
    }, 0)
  }

  // Keyboard shortcut handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault()
      applyFormat('**', '**', 'chữ in đậm')
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault()
      applyFormat('*', '*', 'chữ in nghiêng')
    }
  }

  return (
    <div className="markdown-editor-container">
      {/* Top Header & Formatting Toolbar */}
      <div className="markdown-editor-header">
        <div className="markdown-toolbar">
          <button
            type="button"
            className="md-tool-btn"
            onClick={() => applyFormat('**', '**', 'chữ in đậm')}
            disabled={disabled || mode === 'preview'}
            title="In đậm (Ctrl+B)"
            aria-label="In đậm"
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            className="md-tool-btn"
            onClick={() => applyFormat('*', '*', 'chữ in nghiêng')}
            disabled={disabled || mode === 'preview'}
            title="In nghiêng (Ctrl+I)"
            aria-label="In nghiêng"
          >
            <em>I</em>
          </button>
          <button
            type="button"
            className="md-tool-btn"
            onClick={() => applyFormat('~~', '~~', 'gạch ngang')}
            disabled={disabled || mode === 'preview'}
            title="Gạch ngang"
            aria-label="Gạch ngang"
          >
            <span style={{ textDecoration: 'line-through' }}>S</span>
          </button>

          <span className="md-tool-divider" />

          <button
            type="button"
            className="md-tool-btn"
            onClick={() => insertLinePrefix('### ')}
            disabled={disabled || mode === 'preview'}
            title="Heading (Cỡ chữ tiêu đề)"
            aria-label="Heading"
          >
            <span style={{ fontWeight: 700 }}>H</span>
          </button>
          <button
            type="button"
            className="md-tool-btn"
            onClick={() => insertLinePrefix('- ')}
            disabled={disabled || mode === 'preview'}
            title="Danh sách gạch đầu dòng"
            aria-label="Danh sách gạch đầu dòng"
          >
            •
          </button>
          <button
            type="button"
            className="md-tool-btn"
            onClick={() => insertLinePrefix('1. ')}
            disabled={disabled || mode === 'preview'}
            title="Danh sách số"
            aria-label="Danh sách số"
          >
            1.
          </button>

          <span className="md-tool-divider" />

          <button
            type="button"
            className="md-tool-btn"
            onClick={() => applyFormat('[', '](https://example.com)', 'liên kết')}
            disabled={disabled || mode === 'preview'}
            title="Chèn liên kết"
            aria-label="Chèn liên kết"
          >
            🔗
          </button>
          <button
            type="button"
            className="md-tool-btn"
            onClick={() => applyFormat('`', '`', 'mã')}
            disabled={disabled || mode === 'preview'}
            title="Mã nội dòng"
            aria-label="Mã nội dòng"
          >
            &lt;/&gt;
          </button>
          <button
            type="button"
            className="md-tool-btn"
            onClick={() => insertLinePrefix('> ')}
            disabled={disabled || mode === 'preview'}
            title="Trích dẫn"
            aria-label="Trích dẫn"
          >
            ❝
          </button>
        </div>

        {/* Edit vs Preview Toggle Pills */}
        <div className="markdown-view-toggle">
          <button
            type="button"
            className={`toggle-tab-btn ${mode === 'edit' ? 'active' : ''}`}
            onClick={() => setMode('edit')}
          >
            Soạn thảo
          </button>
          <button
            type="button"
            className={`toggle-tab-btn ${mode === 'preview' ? 'active' : ''}`}
            onClick={() => setMode('preview')}
          >
            Xem trước
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="markdown-editor-body">
        {mode === 'edit' ? (
          <textarea
            ref={textareaRef}
            id={id}
            rows={4}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={10000}
            placeholder={placeholder}
            disabled={disabled}
            className="markdown-textarea"
            aria-label="Mô tả"
          />
        ) : (
          <div className="markdown-preview-pane">
            <MarkdownViewer content={value} />
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="markdown-editor-footer">
        <span className="md-hint">💡 Hỗ trợ định dạng Markdown</span>
        <span className="md-char-count">{value.length}/10000</span>
      </div>
    </div>
  )
}
