import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'

export interface ConfirmOptions {
  title: string
  message: React.ReactNode
  confirmText?: string
  cancelText?: string | null
  variant?: 'danger' | 'warning' | 'info'
  icon?: React.ReactNode
}

export interface ConfirmDialogProps extends ConfirmOptions {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  isConfirming?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/**
 * Standalone UI Component for Confirmation Dialog
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  variant = 'danger',
  icon,
  onConfirm,
  onCancel,
  isConfirming = false,
}: ConfirmDialogProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  // Focus cancel button on open for safe keyboard navigation (or confirm button if alert-only)
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (cancelText && cancelBtnRef.current) {
          cancelBtnRef.current.focus()
        } else {
          confirmBtnRef.current?.focus()
        }
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen, cancelText])

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const renderIcon = () => {
    if (icon) return icon

    if (variant === 'danger') {
      return (
        <div className="confirm-icon-badge danger" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </div>
      )
    }

    if (variant === 'warning') {
      return (
        <div className="confirm-icon-badge warning" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
      )
    }

    return (
      <div className="confirm-icon-badge info" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </div>
    )
  }

  return (
    <div
      className="confirm-dialog-backdrop"
      onClick={onCancel}
      data-testid="confirm-dialog"
      role="presentation"
    >
      <div
        className="confirm-dialog-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
      >
        <div className="confirm-dialog-header">
          {renderIcon()}
          <div className="confirm-dialog-text">
            <h3 id="confirm-dialog-title" className="confirm-dialog-title">
              {title}
            </h3>
            <div id="confirm-dialog-desc" className="confirm-dialog-description">
              {message}
            </div>
          </div>
        </div>

        <div className="confirm-dialog-actions">
          {Boolean(cancelText) && (
            <button
              ref={cancelBtnRef}
              type="button"
              className="confirm-btn-cancel"
              onClick={onCancel}
              disabled={isConfirming}
              data-testid="confirm-dialog-cancel-btn"
            >
              {cancelText}
            </button>
          )}
          <button
            ref={confirmBtnRef}
            type="button"
            className={`confirm-btn-action ${variant}`}
            onClick={onConfirm}
            disabled={isConfirming}
            data-testid="confirm-dialog-btn"
          >
            {isConfirming ? (
              <span className="confirm-btn-loading">
                <span className="spinner-dot"></span>
                <span>Đang xử lý...</span>
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Context Provider enabling declarative and imperative `useConfirm` throughout the application
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [dialogState, setDialogState] = useState<
    (ConfirmOptions & { isOpen: boolean; resolve: (val: boolean) => void }) | null
  >(null)

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setDialogState({
        ...options,
        isOpen: true,
        resolve,
      })
    })
  }, [])

  const handleConfirm = () => {
    if (dialogState) {
      dialogState.resolve(true)
      setDialogState(null)
    }
  }

  const handleCancel = () => {
    if (dialogState) {
      dialogState.resolve(false)
      setDialogState(null)
    }
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialogState && (
        <ConfirmDialog
          isOpen={dialogState.isOpen}
          title={dialogState.title}
          message={dialogState.message}
          confirmText={dialogState.confirmText}
          cancelText={dialogState.cancelText}
          variant={dialogState.variant}
          icon={dialogState.icon}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  )
}

/**
 * Hook to trigger the UI confirmation dialog.
 * Gracefully falls back to browser confirm if unmounted (useful for narrow unit tests).
 */
export function useConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext)

  if (!context) {
    return async (options: ConfirmOptions) => {
      // Fallback for tests or components rendered outside ConfirmProvider
      const messageText = typeof options.message === 'string'
        ? options.message
        : options.title
      return window.confirm(messageText)
    }
  }

  return context
}
