import React, { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/auth-provider'
import { useI18n } from '../i18n/i18n-provider'
import { QuickLanguageButton } from './QuickLanguageButton'
import { AccountDropdown } from './AccountDropdown'

export function AppLayout() {
  const { profile } = useAuth()
  const { t } = useI18n()
  const location = useLocation()
  const [accessDeniedMsg, setAccessDeniedMsg] = useState<string | null>(null)

  useEffect(() => {
    if (location.state?.accessDenied) {
      setAccessDeniedMsg(location.state.accessDenied)
      // Clear history state so refresh doesn't show it again
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  const getBreadcrumb = () => {
    if (location.pathname.startsWith('/tasks')) return t('nav.tasks')
    if (location.pathname.startsWith('/calendar')) return t('nav.calendar')
    if (location.pathname.startsWith('/summary')) return t('nav.summary')
    if (location.pathname.startsWith('/settings')) return t('nav.settings')
    return t('nav.dashboard')
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <h1>TabDo</h1>
        </div>
        <nav className="sidebar-nav">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            {t('nav.dashboard')}
          </NavLink>
          <NavLink
            to="/tasks/inbox"
            className={() => (location.pathname.startsWith('/tasks') ? 'nav-item active' : 'nav-item')}
          >
            {t('nav.tasks')}
          </NavLink>
          <NavLink
            to="/calendar"
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            {t('nav.calendar')}
          </NavLink>
          <NavLink
            to="/summary"
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            {t('nav.summary')}
          </NavLink>
          {profile?.role === 'admin' && (
            <NavLink
              to="/admin/users"
              className="nav-item admin-switch-link"
            >
              {t('nav.adminPortal')}
            </NavLink>
          )}
        </nav>
      </aside>

      <div className="app-content-wrapper">
        <header className="app-topbar">
          <div className="topbar-left">
            <span className="topbar-breadcrumb">{getBreadcrumb()}</span>
          </div>
          <div className="topbar-right">
            <QuickLanguageButton />
            <AccountDropdown />
          </div>
        </header>

        <main className={`app-main ${location.pathname.startsWith('/calendar') ? 'app-main-fullwidth' : ''}`}>
          {accessDeniedMsg && (
            <div className="access-denied-banner" role="alert">
              <span>{accessDeniedMsg}</span>
              <button
                type="button"
                className="banner-close"
                onClick={() => setAccessDeniedMsg(null)}
              >
                &times;
              </button>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
