import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './auth-provider'

export function AdminRoute({ children }: { children?: React.ReactNode }) {
  const { session, profile, isAuthLoading, isProfileLoading, profileError, refreshProfile, signOut } = useAuth()
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

  if (profile?.isActive === false) {
    return (
      <div className="auth-error-state" role="alert">
        <h2>Tài khoản đã bị vô hiệu hóa</h2>
        <p>Tài khoản của bạn hiện đang bị khóa hoặc chưa được kích hoạt. Vui lòng liên hệ quản trị viên.</p>
        <button type="button" onClick={() => signOut()}>
          Đăng xuất
        </button>
      </div>
    )
  }

  if (profile?.mustChangePassword === true) {
    return <Navigate to="/change-password" replace state={{ from: location }} />
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
