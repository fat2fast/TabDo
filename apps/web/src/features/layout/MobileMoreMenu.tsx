import React, { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import type { UserProfile } from '@tabdo/types'
import { useI18n } from '../i18n/i18n-provider'
import { QuickLanguageButton } from './QuickLanguageButton'
import { BUILD_INFO_STRING } from '../../lib/build-info'

interface MobileMoreMenuProps {
  isOpen: boolean
  onClose: () => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
  profile: UserProfile | null
  onSignOut: () => void
}

export function MobileMoreMenu({
  isOpen,
  onClose,
  triggerRef,
  profile,
  onSignOut,
}: MobileMoreMenuProps) {
  const { t } = useI18n()
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const timer = setTimeout(() => {
      closeBtnRef.current?.focus()
    }, 50)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key === 'Tab' && sheetRef.current) {
        const focusableElements = sheetRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement?.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement?.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    // Automatically close and clean up if viewport transitions from mobile to desktop
    let mql: MediaQueryList | null = null
    let handleMediaChange: ((e: MediaQueryListEvent) => void) | null = null
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      mql = window.matchMedia('(max-width: 768px)')
      if (!mql.matches) {
        onClose()
      } else {
        handleMediaChange = (e: MediaQueryListEvent) => {
          if (!e.matches) {
            onClose()
          }
        }
        mql.addEventListener('change', handleMediaChange)
      }
    }

    return () => {
      clearTimeout(timer)
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', handleKeyDown)
      if (mql && handleMediaChange) {
        mql.removeEventListener('change', handleMediaChange)
      }
      // Only restore focus to mobile trigger button if still in mobile viewport
      if (typeof window !== 'undefined' && window.innerWidth <= 768) {
        triggerRef.current?.focus()
      }
    }
  }, [isOpen, onClose, triggerRef])

  if (!isOpen) return null

  return (
    <>
      <div
        className="mobile-more-backdrop"
        onClick={onClose}
        data-testid="mobile-more-backdrop"
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        className="mobile-more-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.more')}
        data-testid="mobile-more-sheet"
      >
        <div className="mobile-sheet-handle" aria-hidden="true" />
        <div className="mobile-sheet-header">
          <h2 className="mobile-sheet-title">{t('nav.more')}</h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="mobile-sheet-close-btn"
            onClick={onClose}
            aria-label={t('nav.closeMore')}
            data-testid="mobile-more-close-btn"
          >
            &times;
          </button>
        </div>

        <nav className="mobile-sheet-nav" aria-label={t('nav.more')}>
          <NavLink
            to="/summary"
            end
            className={({ isActive }) =>
              isActive ? "mobile-sheet-link active" : "mobile-sheet-link"
            }
            onClick={onClose}
          >
            <span className="mobile-sheet-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            </span>
            <span>{t('nav.summary')}</span>
          </NavLink>

          <NavLink
            to="/summary/monthly"
            className={({ isActive }) =>
              isActive ? "mobile-sheet-link active" : "mobile-sheet-link"
            }
            onClick={onClose}
          >
            <span className="mobile-sheet-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </span>
            <span>{t('nav.monthlyReport')}</span>
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              isActive ? "mobile-sheet-link active" : "mobile-sheet-link"
            }
            onClick={onClose}
          >
            <span className="mobile-sheet-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </span>
            <span>{t('nav.settings')}</span>
          </NavLink>

          {profile?.role === 'admin' && (
            <>
              <div className="mobile-sheet-divider" />
              <NavLink
                to="/admin/users"
                className="mobile-sheet-link admin-link"
                onClick={onClose}
              >
                <span className="mobile-sheet-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </span>
                <span>{t('nav.adminPortal')}</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="mobile-sheet-footer">
          <div className="mobile-sheet-divider" />
          <div className="mobile-sheet-user-row">
            <div className="mobile-sheet-user-info">
              <span className="mobile-sheet-user-name">
                {profile?.displayName || 'Người dùng'}
              </span>
              <span className="mobile-sheet-user-role">
                {profile?.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}
              </span>
            </div>
            <QuickLanguageButton />
          </div>

          <button
            type="button"
            className="mobile-sheet-signout-btn"
            onClick={() => {
              onClose()
              onSignOut()
            }}
          >
            {t('nav.signOut')}
          </button>

          <div className="mobile-sheet-version">{BUILD_INFO_STRING}</div>
        </div>
      </div>
    </>
  )
}
