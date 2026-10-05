import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { AccountMenu } from './AccountMenu'

export function AdminLayout() {
  return (
    <div className="app-shell admin-shell">
      <aside className="app-sidebar admin-sidebar">
        <div className="sidebar-header">
          <h1>TabDo Admin</h1>
        </div>
        <nav className="sidebar-nav">
          <NavLink
            to="/admin/users"
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            Người dùng
          </NavLink>
          <NavLink
            to="/dashboard"
            className="nav-item user-portal-link"
          >
            Cổng người dùng
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <AccountMenu />
        </div>
      </aside>
      <main className="app-main admin-main">
        <Outlet />
      </main>
    </div>
  )
}
