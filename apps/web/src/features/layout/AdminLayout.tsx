import React from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { QuickLanguageButton } from './QuickLanguageButton'
import { AccountDropdown } from './AccountDropdown'
import { useI18n } from '../i18n/i18n-provider'

export function AdminLayout() {
  const { t } = useI18n()
  const location = useLocation()

  return (
    <div className="app-shell admin-shell">
      <aside className="app-sidebar admin-sidebar">
        <div className="sidebar-header">
          <h1>{t('admin.portalTitle')}</h1>
        </div>
        <nav className="sidebar-nav">
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            {t('nav.adminDashboard')}
          </NavLink>
          <NavLink
            to="/admin/users"
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            {t('nav.adminUsers')}
          </NavLink>
          <NavLink
            to="/dashboard"
            className="nav-item user-portal-link"
          >
            {t('nav.userPortal')}
          </NavLink>
        </nav>
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
