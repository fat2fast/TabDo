import React from 'react'
import { CreateUserForm } from '../features/admin/CreateUserForm'

export function AdminUsersPage() {
  return (
    <div className="admin-users-page">
      <div className="page-header">
        <h2>Quản lý người dùng</h2>
      </div>
      <CreateUserForm />
    </div>
  )
}
