import React, { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/auth-provider'
import { useI18n } from '../i18n/i18n-provider'
import { QuickLanguageButton } from './QuickLanguageButton'
import { AccountDropdown } from './AccountDropdown'

import { useSidebarCollapse } from './use-sidebar-collapse'
import { BUILD_INFO_STRING } from '../../lib/build-info'

export function AppLayout() {
  const { profile } = useAuth()
  const { t } = useI18n()
  const location = useLocation()
  const [accessDeniedMsg, setAccessDeniedMsg] = useState<string | null>(null)
  const { isCollapsed, toggleSidebar } = useSidebarCollapse()

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
    <div className={`app-shell ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`app-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          {isCollapsed ? (
            <div className="sidebar-logo-collapsed" title="TabDo" aria-label="TabDo">
              TD
            </div>
          ) : (
            <h1>TabDo</h1>
          )}
        </div>
        <nav className="sidebar-nav">
          <NavLink
            to="/dashboard"
            title={t('nav.dashboard')}
            aria-label={t('nav.dashboard')}
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            <span className="nav-item-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </span>
            <span className="nav-label">{t('nav.dashboard')}</span>
          </NavLink>

          <div className="sidebar-divider" />

          <NavLink
            to="/tasks/inbox"
            title={t('nav.tasks')}
            aria-label={t('nav.tasks')}
            className={() => (location.pathname.startsWith('/tasks') ? 'nav-item active' : 'nav-item')}
          >
            <span className="nav-item-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                <path d="m9 14 2 2 4-4"/>
              </svg>
            </span>
            <span className="nav-label">{t('nav.tasks')}</span>
          </NavLink>

          <NavLink
            to="/calendar"
            title={t('nav.calendar')}
            aria-label={t('nav.calendar')}
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            <span className="nav-item-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </span>
            <span className="nav-label">{t('nav.calendar')}</span>
          </NavLink>

          <NavLink
            to="/summary"
            title={t('nav.summary')}
            aria-label={t('nav.summary')}
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            <span className="nav-item-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            </span>
            <span className="nav-label">{t('nav.summary')}</span>
          </NavLink>

          {profile?.role === 'admin' && (
            <>
              <div className="sidebar-divider" />
              <NavLink
                to="/admin/users"
                title={t('nav.adminPortal')}
                aria-label={t('nav.adminPortal')}
                className="nav-item admin-switch-link"
              >
                <span className="nav-item-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </span>
                <span className="nav-label">{t('nav.adminPortal')}</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          {isCollapsed ? (
            <button
              type="button"
              className="sidebar-expand-btn"
              onClick={toggleSidebar}
              title={`${t('nav.expandSidebar')} (${BUILD_INFO_STRING})`}
              aria-label={t('nav.expandSidebar')}
              aria-expanded={false}
              data-testid="sidebar-expand-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="13 17 18 12 13 7"/>
                <polyline points="6 17 11 12 6 7"/>
              </svg>
            </button>
          ) : (
            <>
              <button
                type="button"
                className="sidebar-toggle-btn"
                onClick={toggleSidebar}
                title={t('nav.collapseSidebar')}
                aria-label={t('nav.collapseSidebar')}
                aria-expanded={true}
                data-testid="sidebar-collapse-btn"
              >
                <div className="sidebar-toggle-left">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <line x1="3" y1="12" x2="21" y2="12"/>
                    <line x1="3" y1="18" x2="21" y2="18"/>
                  </svg>
                  <span>{t('nav.collapseSidebar')}</span>
                </div>
                <svg className="sidebar-toggle-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="11 17 6 12 11 7"/>
                  <polyline points="18 17 13 12 18 7"/>
                </svg>
              </button>
              <div className="sidebar-version-footer" data-testid="sidebar-version-footer">
                {BUILD_INFO_STRING}
              </div>
            </>
          )}
        </div>
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
