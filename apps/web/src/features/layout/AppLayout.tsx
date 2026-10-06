import React, { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/auth-provider'
import { AccountMenu } from './AccountMenu'

export function AppLayout() {
  const { profile } = useAuth()
  const location = useLocation()
  const [accessDeniedMsg, setAccessDeniedMsg] = useState<string | null>(null)

  useEffect(() => {
    if (location.state?.accessDenied) {
      setAccessDeniedMsg(location.state.accessDenied)
      // Clear history state so refresh doesn't show it again
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

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
            Dashboard
          </NavLink>
          <NavLink
            to="/tasks/inbox"
            className={() => (location.pathname.startsWith('/tasks') ? 'nav-item active' : 'nav-item')}
          >
            Tasks
          </NavLink>
          <NavLink
            to="/calendar"
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            Calendar
          </NavLink>
          <NavLink
            to="/summary"
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            Summary
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            Settings
          </NavLink>
          {profile?.role === 'admin' && (
            <NavLink
              to="/admin/users"
              className="nav-item admin-switch-link"
            >
              Quản trị
            </NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          <AccountMenu />
        </div>
      </aside>
      <main className="app-main">
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
  )
}
