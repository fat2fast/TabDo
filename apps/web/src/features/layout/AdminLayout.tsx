import React from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { QuickLanguageButton } from './QuickLanguageButton'
import { AccountDropdown } from './AccountDropdown'
import { useI18n } from '../i18n/i18n-provider'

import { useSidebarCollapse } from './use-sidebar-collapse'
import { BUILD_INFO_STRING } from '../../lib/build-info'

export function AdminLayout() {
  const { t } = useI18n()
  const location = useLocation()
  const { isCollapsed, toggleSidebar } = useSidebarCollapse()

  return (
    <div className={`app-shell admin-shell ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`app-sidebar admin-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          {isCollapsed ? (
            <div className="sidebar-logo-collapsed" title={t('admin.portalTitle')} aria-label={t('admin.portalTitle')}>
              AD
            </div>
          ) : (
            <h1>{t('admin.portalTitle')}</h1>
          )}
        </div>
        <nav className="sidebar-nav">
          <NavLink
            to="/admin/dashboard"
            title={t('nav.adminDashboard')}
            aria-label={t('nav.adminDashboard')}
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            <span className="nav-item-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="9"/>
                <rect x="14" y="3" width="7" height="5"/>
                <rect x="14" y="12" width="7" height="9"/>
                <rect x="3" y="16" width="7" height="5"/>
              </svg>
            </span>
            <span className="nav-label">{t('nav.adminDashboard')}</span>
          </NavLink>

          <NavLink
            to="/admin/users"
            title={t('nav.adminUsers')}
            aria-label={t('nav.adminUsers')}
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            <span className="nav-item-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </span>
            <span className="nav-label">{t('nav.adminUsers')}</span>
          </NavLink>

          <div className="sidebar-divider" />

          <NavLink
            to="/dashboard"
            title={t('nav.userPortal')}
            aria-label={t('nav.userPortal')}
            className="nav-item user-portal-link"
          >
            <span className="nav-item-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </span>
            <span className="nav-label">{t('nav.userPortal')}</span>
          </NavLink>
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
              data-testid="admin-sidebar-expand-btn"
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
                data-testid="admin-sidebar-collapse-btn"
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
              <div className="sidebar-version-footer" data-testid="admin-sidebar-version-footer">
                {BUILD_INFO_STRING}
              </div>
            </>
          )}
        </div>
      </aside>

      <div className="app-content-wrapper">
        <header className="app-topbar admin-topbar">
          <div className="topbar-left">
            <span className="admin-portal-badge">
              {location.pathname.startsWith('/admin/users')
                ? t('nav.adminUsers')
                : t('nav.adminDashboard')}
            </span>
          </div>
          <div className="topbar-right">
            <QuickLanguageButton />
            <AccountDropdown />
          </div>
        </header>

        <main className="app-main admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
