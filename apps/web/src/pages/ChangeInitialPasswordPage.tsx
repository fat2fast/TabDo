import React, { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/auth-provider'
import { useI18n } from '../features/i18n/i18n-provider'
import { supabase } from '../lib/supabase'

export function ChangeInitialPasswordPage() {
  const { session, profile, isAuthLoading, isProfileLoading, refreshProfile, signOut } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  if (isAuthLoading || isProfileLoading) {
    return (
      <div className="auth-loading-state" role="status">
        <div className="spinner" style={{ width: '28px', height: '28px', margin: '0 auto 8px' }}></div>
        <p>{t('common.loading')}</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (profile?.isActive === false) {
    return (
      <div className="auth-error-state" role="alert">
        <h2>{t('auth.accountDisabled')}</h2>
        <button type="button" className="auth-secondary-btn" onClick={() => signOut()}>
          {t('nav.signOut')}
        </button>
      </div>
    )
  }

  // If user is already active and does not need to change password, redirect to portal
  if (profile && !profile.mustChangePassword) {
    return <Navigate to={profile.role === 'admin' ? '/admin/dashboard' : '/dashboard'} replace />
  }

  const isLengthValid = newPassword.length >= 8
  const isMatchValid = newPassword.length > 0 && newPassword === confirmPassword

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!isLengthValid) {
      setErrorMessage(t('auth.passwordTooShort'))
      return
    }

    if (!isMatchValid) {
      setErrorMessage(t('auth.passwordMismatch'))
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase.functions.invoke('complete-initial-password', {
        body: { newPassword },
      })

      if (error) {
        let msg = error.message
        if (typeof (error as any).context?.json === 'function') {
          try {
            const json = await (error as any).context.json()
            if (json?.error) msg = json.error
          } catch {
            // ignore
          }
        }
        setErrorMessage(msg || 'Không thể đổi mật khẩu. Vui lòng thử lại.')
        return
      }

      setSuccessMessage(t('auth.passwordUpdatedSuccess'))
      await refreshProfile()
      setTimeout(() => {
        navigate(profile?.role === 'admin' ? '/admin/dashboard' : '/dashboard', { replace: true })
      }, 500)
    } catch (err: any) {
      setErrorMessage(err?.message || 'Đã có lỗi xảy ra khi đổi mật khẩu.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="change-password-container">
      <div className="change-password-card">
        {/* Header Icon & Security Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div className="change-password-icon-wrapper">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <span className="change-password-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            {t('auth.securityBadge')}
          </span>
        </div>

        <h2>{t('auth.changeInitialPasswordTitle')}</h2>
        <p className="change-password-subtitle">
          {t('auth.changeInitialPasswordSubtitle')}
        </p>

        {errorMessage && (
          <div className="login-error-banner" role="alert" style={{ marginBottom: '16px' }}>
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            className="alert-success"
            role="status"
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              fontSize: '0.875rem',
              fontWeight: 500,
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="new-password">{t('auth.newPassword')} *</label>
            <div className="password-input-wrapper">
              <input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowNewPassword(!showNewPassword)}
                aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                tabIndex={-1}
              >
                {showNewPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirm-password">{t('auth.confirmPassword')} *</label>
            <div className="password-input-wrapper">
              <input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Interactive Password Requirements Checklist */}
          <div className="password-checklist">
            <div className={`password-check-item ${isLengthValid ? 'valid' : 'invalid'}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                {isLengthValid ? (
                  <polyline points="20 6 9 17 4 12" />
                ) : (
                  <circle cx="12" cy="12" r="6" />
                )}
              </svg>
              <span>{t('auth.reqMinLength')}</span>
            </div>
            <div className={`password-check-item ${isMatchValid ? 'valid' : 'invalid'}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                {isMatchValid ? (
                  <polyline points="20 6 9 17 4 12" />
                ) : (
                  <circle cx="12" cy="12" r="6" />
                )}
              </svg>
              <span>{t('auth.reqMatch')}</span>
            </div>
          </div>

          <button
            type="submit"
            className="login-submit-button"
            disabled={isSubmitting || !isLengthValid || !isMatchValid}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '12px',
            }}
          >
            {isSubmitting ? (
              <>
                <span className="spinner-dot" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#ffffff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }}></span>
                <span>{t('common.saving')}</span>
              </>
            ) : (
              <span>{t('auth.updatePassword')}</span>
            )}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          <button
            type="button"
            className="auth-secondary-btn"
            onClick={() => signOut()}
            disabled={isSubmitting}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>{t('nav.signOut')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
