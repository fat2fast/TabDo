import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth-provider'

interface LoginFormProps {
  portal: 'user' | 'admin'
}

export function LoginForm({ portal }: LoginFormProps) {
  const { signIn, session, profile, isAuthLoading, isProfileLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Redirect if already authenticated
  useEffect(() => {
    if (!isAuthLoading && !isProfileLoading && session && profile) {
      if (portal === 'admin') {
        if (profile.role === 'admin') {
          navigate('/admin/users', { replace: true })
        } else {
          navigate('/dashboard', {
            replace: true,
            state: { accessDenied: 'Bạn không có quyền truy cập khu vực quản trị.' },
          })
        }
      } else {
        const fromState = (location.state as any)?.from
        let destination = '/dashboard'
        if (fromState) {
          if (typeof fromState === 'string') {
            destination = fromState
          } else if (fromState.pathname) {
            const search = fromState.search || ''
            const hash = fromState.hash || ''
            destination = `${fromState.pathname}${search}${hash}`
          }
        }
        navigate(destination, { replace: true })
      }
    }
  }, [session, profile, isAuthLoading, isProfileLoading, portal, navigate, location])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      const { error } = await signIn(email, password)
      if (error) {
        setErrorMessage(error.message)
        setIsSubmitting(false)
        return
      }
      // Post-login redirect is handled by useEffect when session and profile settle
    } catch (err: any) {
      setErrorMessage(err?.message || 'Đăng nhập không thành công.')
      setIsSubmitting(false)
    }
  }

  const title = portal === 'admin' ? 'Đăng nhập Quản trị viên' : 'Đăng nhập TabDo'

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>{title}</h1>
        {portal === 'admin' ? (
          <p className="login-subtitle">Cổng quản trị hệ thống TabDo</p>
        ) : (
          <p className="login-subtitle">Đăng nhập vào tài khoản cá nhân của bạn</p>
        )}

        {errorMessage && (
          <div className="login-error-banner" role="alert">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              autoComplete="email"
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              disabled={isSubmitting}
            />
          </div>

          <button
            type="submit"
            className="login-submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Đang xử lý...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  )
}
