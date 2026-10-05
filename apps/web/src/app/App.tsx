import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthenticatedRoute } from '../features/auth/authenticated-route'
import { AdminRoute } from '../features/auth/admin-route'
import { AppLayout } from '../features/layout/AppLayout'
import { AdminLayout } from '../features/layout/AdminLayout'
import { LoginPage } from '../pages/LoginPage'
import { AdminLoginPage } from '../pages/AdminLoginPage'
import { DashboardPage } from '../pages/DashboardPage'
import { TasksPage } from '../pages/TasksPage'
import { CalendarPage } from '../pages/CalendarPage'
import { SummaryPage } from '../pages/SummaryPage'
import { SettingsPage } from '../pages/SettingsPage'
import { AdminUsersPage } from '../pages/AdminUsersPage'

export function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />

      {/* Protected User Portal */}
      <Route element={<AuthenticatedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/:id" element={<TasksPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/summary" element={<SummaryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Protected Admin Portal */}
      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
        </Route>
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
