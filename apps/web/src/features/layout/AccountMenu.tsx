import React from 'react'
import { useAuth } from '../auth/auth-provider'

export function AccountMenu() {
  const { user, profile, signOut } = useAuth()

  const displayName = profile?.displayName || user?.email?.split('@')[0] || 'Tài khoản'
  const roleLabel = profile?.role === 'admin' ? 'Quản trị viên' : 'Người dùng'

  return (
    <div className="account-menu">
      <div className="account-details">
        <span className="account-name">{displayName}</span>
        <span className="account-role-badge">{roleLabel}</span>
      </div>
      <button
        type="button"
        className="logout-button"
        onClick={() => signOut()}
      >
        Đăng xuất
      </button>
    </div>
  )
}
