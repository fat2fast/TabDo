import React, { useEffect, useRef } from 'react'

export interface AutoResizeTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  minHeight?: number
}

export function AutoResizeTextarea({
  value,
  onChange,
  className = '',
  minHeight = 44,
  onKeyDown,
  ...props
}: AutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const resize = () => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      const newHeight = Math.max(minHeight, el.scrollHeight)
      el.style.height = `${newHeight}px`
    }
  }

  useEffect(() => {
    resize()
  }, [value, minHeight])

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e)
        resize()
      }}
      rows={1}
      className={`auto-resize-textarea ${className}`}
      onKeyDown={(e) => {
        // Prevent accidental newline on standard Enter in title fields
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
        }
        onKeyDown?.(e)
      }}
      {...props}
    />
  )
}
