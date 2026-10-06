import React, { useState } from 'react'

interface SignInViewProps {
  onSignIn: (credentials: { email: string; password: string }) => Promise<void>
  isLoading?: boolean
  error?: string | null
}

export function SignInView({ onSignIn, isLoading = false, error = null }: SignInViewProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    if (!email.trim()) {
      setValidationError('Vui lòng nhập email')
      return
    }
    if (!password) {
      setValidationError('Vui lòng nhập mật khẩu')
      return
    }

    try {
      await onSignIn({ email: email.trim(), password })
      // Clear password from local state immediately after submit
      setPassword('')
    } catch {
      setPassword('')
    }
  }

  const displayedError = validationError || error

  return (
    <div className="tabdo-view sign-in-view">
      <div className="tabdo-header">
        <div className="tabdo-brand">
          <div className="tabdo-logo-badge">TD</div>
          <div>
            <h1 className="tabdo-title">TabDo</h1>
            <p className="tabdo-subtitle">Tiện ích quản lý công việc cá nhân</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="tabdo-form" noValidate>
        {displayedError && (
          <div className="tabdo-alert tabdo-alert-danger" role="alert">
            {displayedError}
          </div>
        )}

        <div className="tabdo-field">
          <label htmlFor="signin-email" className="tabdo-label">
            Email
          </label>
          <input
            id="signin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ban@example.com"
            disabled={isLoading}
            required
            className="tabdo-input"
            autoComplete="email"
          />
        </div>

        <div className="tabdo-field">
          <label htmlFor="signin-password" className="tabdo-label">
            Mật khẩu
          </label>
          <input
            id="signin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={isLoading}
            required
            className="tabdo-input"
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="tabdo-btn tabdo-btn-primary tabdo-btn-block"
        >
          {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>

        <p className="tabdo-footnote">
          Đăng nhập bằng tài khoản TabDo hiện có của bạn.
        </p>
      </form>
    </div>
  )
}
