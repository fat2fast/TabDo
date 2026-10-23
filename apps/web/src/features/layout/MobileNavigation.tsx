import React, { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { UserProfile } from '@tabdo/types'
import { useI18n } from '../i18n/i18n-provider'
import { MobileMoreMenu } from './MobileMoreMenu'

interface MobileNavigationProps {
  profile: UserProfile | null
  onSignOut: () => void
}

export function MobileNavigation({ profile, onSignOut }: MobileNavigationProps) {
  const { t } = useI18n()
  const location = useLocation()
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const moreTriggerRef = useRef<HTMLButtonElement>(null)

  // Auto-close More menu when viewport transitions from mobile to desktop
  useEffect(() => {
    if (!isMoreOpen) return
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mql = window.matchMedia('(max-width: 768px)')
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (!e.matches) {
        setIsMoreOpen(false)
      }
    }
    mql.addEventListener('change', handleMediaChange)
    return () => mql.removeEventListener('change', handleMediaChange)
  }, [isMoreOpen])

  const isTasksActive = location.pathname.startsWith('/tasks')
  const isCalendarActive = location.pathname.startsWith('/calendar')
  const isDashboardActive = location.pathname === '/dashboard' || location.pathname === '/'
  const isMoreActive =
    isMoreOpen ||
    location.pathname.startsWith('/summary') ||
    location.pathname.startsWith('/settings') ||
    location.pathname.startsWith('/admin')

  return (
    <>
      <nav className="mobile-bottom-nav" aria-label={t('nav.menu')} data-testid="mobile-bottom-nav">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            isActive || isDashboardActive ? "mobile-nav-item active" : "mobile-nav-item"
          }
          title={t('nav.dashboard')}
          aria-label={t('nav.dashboard')}
        >
          <span className="mobile-nav-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </span>
          <span>{t('nav.dashboard')}</span>
        </NavLink>

        <NavLink
          to="/tasks/inbox"
          className={() => (isTasksActive ? "mobile-nav-item active" : "mobile-nav-item")}
          title={t('nav.tasks')}
          aria-label={t('nav.tasks')}
        >
          <span className="mobile-nav-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
              <path d="m9 14 2 2 4-4"/>
            </svg>
          </span>
          <span>{t('nav.tasks')}</span>
        </NavLink>

        <NavLink
          to="/calendar"
          className={({ isActive }) =>
            isActive || isCalendarActive ? "mobile-nav-item active" : "mobile-nav-item"
          }
          title={t('nav.calendar')}
          aria-label={t('nav.calendar')}
        >
          <span className="mobile-nav-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </span>
          <span>{t('nav.calendar')}</span>
        </NavLink>

        <button
          ref={moreTriggerRef}
          type="button"
          className={isMoreActive ? 'mobile-nav-item active' : 'mobile-nav-item'}
          onClick={() => setIsMoreOpen((prev) => !prev)}
          title={t('nav.more')}
          aria-label={t('nav.more')}
          aria-haspopup="dialog"
          aria-expanded={isMoreOpen}
          data-testid="mobile-nav-more-btn"
        >
          <span className="mobile-nav-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1.5"/>
              <circle cx="19" cy="12" r="1.5"/>
              <circle cx="5" cy="12" r="1.5"/>
            </svg>
          </span>
          <span>{t('nav.more')}</span>
        </button>
      </nav>

      <MobileMoreMenu
        isOpen={isMoreOpen}
        onClose={() => setIsMoreOpen(false)}
        triggerRef={moreTriggerRef}
        profile={profile}
        onSignOut={onSignOut}
      />
    </>
  )
}
