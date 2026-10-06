import React, { useRef, useState } from 'react'

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

  // Insert markdown syntax helper
  const applyFormat = (prefix: string, suffix: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)
    const textToInsert = selectedText || defaultText
    const replacement = `${prefix}${textToInsert}${suffix}`

    const newValue = value.substring(0, start) + replacement + value.substring(end)
    onChange(newValue)

    // Re-focus and update cursor
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = start + prefix.length + textToInsert.length
      textarea.setSelectionRange(
        start + prefix.length,
        selectedText ? newCursorPos : start + prefix.length + defaultText.length
      )
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

    const currentLine = value.substring(lineStart, end)
    const newValue = value.substring(0, lineStart) + prefix + value.substring(lineStart)
    onChange(newValue)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + prefix.length, end + prefix.length)
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

  // Simple, safe Markdown renderer for preview mode
  const renderMarkdown = (text: string) => {
    if (!text.trim()) {
      return (
        <div className="markdown-preview-empty">
          <em>Chưa có nội dung mô tả để xem trước.</em>
        </div>
      )
    }

    const lines = text.split('\n')
    const elements: React.ReactNode[] = []

    lines.forEach((line, index) => {
      const trimmed = line.trim()

      // Header 1, 2, 3
      if (line.startsWith('### ')) {
        elements.push(<h3 key={index} className="md-h3">{parseInline(line.slice(4))}</h3>)
      } else if (line.startsWith('## ')) {
        elements.push(<h2 key={index} className="md-h2">{parseInline(line.slice(3))}</h2>)
      } else if (line.startsWith('# ')) {
        elements.push(<h1 key={index} className="md-h1">{parseInline(line.slice(2))}</h1>)
      }
      // Checklist items
      else if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')) {
        const isChecked = trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')
        const content = trimmed.slice(6)
        elements.push(
          <div key={index} className={`md-checklist-row ${isChecked ? 'done' : ''}`}>
            <span className={`md-checkbox-icon ${isChecked ? 'checked' : ''}`}>
              {isChecked ? '☑' : '☐'}
            </span>
            <span className={`md-checklist-text ${isChecked ? 'line-through' : ''}`}>
              {parseInline(content)}
            </span>
          </div>
        )
      }
      // Bullet list
      else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        elements.push(
          <li key={index} className="md-bullet-item">
            {parseInline(trimmed.slice(2))}
          </li>
        )
      }
      // Blockquote
      else if (trimmed.startsWith('> ')) {
        elements.push(
          <blockquote key={index} className="md-blockquote">
            {parseInline(trimmed.slice(2))}
          </blockquote>
        )
      }
      // Blank line
      else if (!trimmed) {
        elements.push(<div key={index} className="md-spacer" />)
      }
      // Normal paragraph
      else {
        elements.push(
          <p key={index} className="md-paragraph">
            {parseInline(line)}
          </p>
        )
      }
    })

    return <div className="markdown-rendered-view">{elements}</div>
  }

  // Parse inline elements: **bold**, *italic*, ~~strike~~, `code`, [link](url)
  const parseInline = (text: string): React.ReactNode => {
    // Regex for bold, italic, strikethrough, code, link
    const parts: React.ReactNode[] = []
    let remaining = text
    let keyIdx = 0

    while (remaining) {
      // Link [text](url)
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)/.exec(remaining)
      if (linkMatch) {
        parts.push(
          <a
            key={keyIdx++}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="md-link"
          >
            {linkMatch[1]}
          </a>
        )
        remaining = remaining.slice(linkMatch[0].length)
        continue
      }

      // Bold **text**
      const boldMatch = /^\*\*([^*]+)\*\*/.exec(remaining)
      if (boldMatch) {
        parts.push(<strong key={keyIdx++}>{boldMatch[1]}</strong>)
        remaining = remaining.slice(boldMatch[0].length)
        continue
      }

      // Italic *text*
      const italicMatch = /^\*([^*]+)\*/.exec(remaining)
      if (italicMatch) {
        parts.push(<em key={keyIdx++}>{italicMatch[1]}</em>)
        remaining = remaining.slice(italicMatch[0].length)
        continue
      }

      // Strikethrough ~~text~~
      const strikeMatch = /^~~([^~]+)~~/.exec(remaining)
      if (strikeMatch) {
        parts.push(<del key={keyIdx++}>{strikeMatch[1]}</del>)
        remaining = remaining.slice(strikeMatch[0].length)
        continue
      }

      // Inline code `code`
      const codeMatch = /^`([^`]+)`/.exec(remaining)
      if (codeMatch) {
        parts.push(<code key={keyIdx++} className="md-inline-code">{codeMatch[1]}</code>)
        remaining = remaining.slice(codeMatch[0].length)
        continue
      }

      // Take first character as plain text
      const nextSpecial = remaining.search(/(\[|\*\*|\*|~~|`)/)
      if (nextSpecial === -1) {
        parts.push(remaining)
        break
      } else if (nextSpecial === 0) {
        parts.push(remaining[0])
        remaining = remaining.slice(1)
      } else {
        parts.push(remaining.slice(0, nextSpecial))
        remaining = remaining.slice(nextSpecial)
      }
    }

    return parts
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
            {renderMarkdown(value)}
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
