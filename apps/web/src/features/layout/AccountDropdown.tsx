import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/auth-provider'
import { useI18n } from '../i18n/i18n-provider'
import { UserGuideModal } from './UserGuideModal'

export function AccountDropdown() {
  const { user, profile, signOut } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()

  const [isOpen, setIsOpen] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const displayName = profile?.displayName || user?.email?.split('@')[0] || t('admin.user')
  const initialLetter = (displayName[0] || user?.email?.[0] || 'U').toUpperCase()
  const roleLabel = profile?.role === 'admin' ? t('admin.adminRole') : t('admin.user')
  const isAdmin = profile?.role === 'admin'
  const isInAdminPortal = location.pathname.startsWith('/admin')

  // Click outside and ESC key listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleNavigateToSettings = () => {
    setIsOpen(false)
    navigate('/settings')
  }

  const handleSwitchPortal = () => {
    setIsOpen(false)
    if (isInAdminPortal) {
      navigate('/dashboard')
    } else {
      navigate('/admin/dashboard')
    }
  }

  const handleSignOut = async () => {
    setIsOpen(false)
    await signOut()
  }

  return (
    <>
      <div className="account-dropdown-wrapper" ref={dropdownRef}>
        <button
          type="button"
          className="topbar-avatar-btn"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="true"
          aria-label={`${displayName} (${roleLabel})`}
          title={`${displayName} (${roleLabel})`}
          data-testid="topbar-avatar-btn"
        >
          <span className="avatar-letter">{initialLetter}</span>
        </button>

        {isOpen && (
          <div className="account-dropdown-menu" role="menu">
            {/* Header: User name and email */}
            <div className="dropdown-user-header">
              <div className="dropdown-user-name-row">
                <span className="dropdown-user-name">{displayName}</span>
                <span className={`dropdown-role-badge ${isAdmin ? 'admin-badge' : 'user-badge'}`}>
                  {roleLabel}
                </span>
              </div>
              <span className="dropdown-user-email">{user?.email || ''}</span>
            </div>

            <div className="dropdown-divider" />

            {/* Account & Security */}
            <button
              type="button"
              className="dropdown-item"
              onClick={handleNavigateToSettings}
              role="menuitem"
            >
              <span className="dropdown-item-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M20 21a8 8 0 1 0-16 0" />
                </svg>
              </span>
              <span className="dropdown-item-label">{t('menu.accountSecurity')}</span>
            </button>

            {/* User Guide */}
            <button
              type="button"
              className="dropdown-item"
              onClick={() => {
                setIsOpen(false)
                setIsGuideOpen(true)
              }}
              role="menuitem"
            >
              <span className="dropdown-item-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
              </span>
              <span className="dropdown-item-label">{t('menu.userGuide')}</span>
            </button>

            {/* Switch between User and Admin Portal (if admin role) */}
            {isAdmin && (
              <button
                type="button"
                className="dropdown-item portal-switch-item"
                onClick={handleSwitchPortal}
                role="menuitem"
              >
                <span className="dropdown-item-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 3 21 3 21 8" />
                    <line x1="4" y1="20" x2="21" y2="3" />
                    <polyline points="8 21 3 21 3 16" />
                    <line x1="15" y1="15" x2="3" y2="21" />
                  </svg>
                </span>
                <span className="dropdown-item-label">
                  {isInAdminPortal ? t('menu.userPortal') : t('menu.adminPortal')}
                </span>
              </button>
            )}

            <div className="dropdown-divider" />

            {/* Sign out */}
            <button
              type="button"
              className="dropdown-item dropdown-logout-item"
              onClick={handleSignOut}
              role="menuitem"
            >
              <span className="dropdown-item-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </span>
              <span className="dropdown-item-label">{t('menu.signOut')}</span>
            </button>
          </div>
        )}
      </div>

      <UserGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </>
  )
}
