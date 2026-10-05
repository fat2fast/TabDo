import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './auth-provider'

export function AdminRoute({ children }: { children?: React.ReactNode }) {
  const { session, profile, isAuthLoading, isProfileLoading, profileError, refreshProfile } = useAuth()
  const location = useLocation()

  if (isAuthLoading || isProfileLoading) {
    return (
      <div className="auth-loading-state" role="status">
        <p>Đang xác thực quyền quản trị...</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />
  }

  if (profileError) {
    return (
      <div className="auth-error-state" role="alert">
        <h2>Lỗi hồ sơ tài khoản</h2>
        <p>{profileError}</p>
        <button type="button" onClick={() => refreshProfile()}>
          Thử lại
        </button>
      </div>
    )
  }

  if (profile?.role !== 'admin') {
    return (
      <Navigate
        to="/dashboard"
        replace
        state={{ accessDenied: 'Bạn không có quyền truy cập khu vực quản trị.' }}
      />
    )
  }

  return children ? <>{children}</> : <Outlet />
}
