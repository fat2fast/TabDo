import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './auth-provider'

export function AuthenticatedRoute({ children }: { children?: React.ReactNode }) {
  const { session, isAuthLoading, isProfileLoading, profileError, refreshProfile } = useAuth()
  const location = useLocation()

  if (isAuthLoading || isProfileLoading) {
    return (
      <div className="auth-loading-state" role="status">
        <p>Đang tải thông tin đăng nhập...</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
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

  return children ? <>{children}</> : <Outlet />
}
