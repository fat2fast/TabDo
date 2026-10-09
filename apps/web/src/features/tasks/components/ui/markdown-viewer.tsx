import React from 'react'

export interface MarkdownViewerProps {
  content: string
  className?: string
}

// Parse inline elements: **bold**, *italic*, ~~strike~~, `code`, [link](url) with nesting support
export function parseMarkdownInline(text: string): React.ReactNode {
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

    // Bold **text** (supports nested formatting inside)
    const boldMatch = /^\*\*([^*]+?)\*\*/.exec(remaining)
    if (boldMatch) {
      parts.push(<strong key={keyIdx++}>{parseMarkdownInline(boldMatch[1])}</strong>)
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    // Italic *text*
    const italicMatch = /^\*([^*]+?)\*/.exec(remaining)
    if (italicMatch) {
      parts.push(<em key={keyIdx++}>{parseMarkdownInline(italicMatch[1])}</em>)
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    // Strikethrough ~~text~~
    const strikeMatch = /^~~([^~]+?)~~/.exec(remaining)
    if (strikeMatch) {
      parts.push(<del key={keyIdx++}>{parseMarkdownInline(strikeMatch[1])}</del>)
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

    // Regular text before next markdown delimiter
    const nextSpecial = remaining.search(/(\*\*|\*|~~|`|\[)/)
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

  return parts.length === 1 ? parts[0] : <>{parts}</>
}

export function MarkdownViewer({ content, className = '' }: MarkdownViewerProps) {
  if (!content || !content.trim()) {
    return (
      <div className={`markdown-viewer-empty ${className}`}>
        <em>Chưa có nội dung mô tả chi tiết.</em>
      </div>
    )
  }

  const lines = content.split('\n')
  const elements: React.ReactNode[] = []

  lines.forEach((line, index) => {
    const trimmed = line.trim()

    // 1. Heading wrapped in bold: **### Heading text**
    const headingWrapMatch = /^\*{2}(#{1,6})\s+(.*?)\*{2}$/.exec(trimmed)
    if (headingWrapMatch) {
      const level = headingWrapMatch[1].length
      const headingContent = headingWrapMatch[2]
      if (level === 1) {
        elements.push(<h1 key={index} className="md-h1"><strong>{parseMarkdownInline(headingContent)}</strong></h1>)
      } else if (level === 2) {
        elements.push(<h2 key={index} className="md-h2"><strong>{parseMarkdownInline(headingContent)}</strong></h2>)
      } else {
        elements.push(<h3 key={index} className="md-h3"><strong>{parseMarkdownInline(headingContent)}</strong></h3>)
      }
      return
    }

    // 2. Standard Heading: ### Heading text (with optional **bold** inside)
    const normalHeadingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed)
    if (normalHeadingMatch) {
      const level = normalHeadingMatch[1].length
      const headingContent = normalHeadingMatch[2]
      if (level === 1) {
        elements.push(<h1 key={index} className="md-h1">{parseMarkdownInline(headingContent)}</h1>)
      } else if (level === 2) {
        elements.push(<h2 key={index} className="md-h2">{parseMarkdownInline(headingContent)}</h2>)
      } else {
        elements.push(<h3 key={index} className="md-h3">{parseMarkdownInline(headingContent)}</h3>)
      }
      return
    }

    // 3. Checklist items: - [ ] or - [x]
    if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')) {
      const isChecked = trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')
      const itemContent = trimmed.slice(6)
      elements.push(
        <div key={index} className={`md-checklist-row ${isChecked ? 'done' : ''}`}>
          <span className={`md-checkbox-icon ${isChecked ? 'checked' : ''}`}>
            {isChecked ? '☑' : '☐'}
          </span>
          <span className={`md-checklist-text ${isChecked ? 'line-through' : ''}`}>
            {parseMarkdownInline(itemContent)}
          </span>
        </div>
      )
      return
    }

    // 4. Bullet list
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <li key={index} className="md-bullet-item">
          {parseMarkdownInline(trimmed.slice(2))}
        </li>
      )
      return
    }

    // 5. Blockquote
    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote key={index} className="md-blockquote">
          {parseMarkdownInline(trimmed.slice(2))}
        </blockquote>
      )
      return
    }

    // 6. Blank line
    if (!trimmed) {
      elements.push(<div key={index} className="md-spacer" />)
      return
    }

    // 7. Normal paragraph
    elements.push(
      <p key={index} className="md-paragraph">
        {parseMarkdownInline(line)}
      </p>
    )
  })

  return <div className={`markdown-rendered-view ${className}`}>{elements}</div>
}
