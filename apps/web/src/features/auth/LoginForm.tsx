import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth-provider'
import { useI18n } from '../i18n/i18n-provider'
import { QuickLanguageButton } from '../layout/QuickLanguageButton'

interface LoginFormProps {
  portal: 'user' | 'admin'
}

export function LoginForm({ portal }: LoginFormProps) {
  const { signIn, session, profile, isAuthLoading, isProfileLoading } = useAuth()
  const { t } = useI18n()
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
            state: { accessDenied: t('auth.accessDenied') },
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
  }, [session, profile, isAuthLoading, isProfileLoading, portal, navigate, location, t])

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
      setErrorMessage(err?.message || t('auth.loginFailed'))
      setIsSubmitting(false)
    }
  }

  const title = portal === 'admin' ? t('auth.adminLoginTitle') : t('auth.loginTitle')
  const subtitle = portal === 'admin' ? t('auth.adminSubtitle') : t('auth.userSubtitle')

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-card-top-bar">
          <QuickLanguageButton />
        </div>
        <h1>{title}</h1>
        <p className="login-subtitle">{subtitle}</p>

        {errorMessage && (
          <div className="login-error-banner" role="alert">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">{t('auth.email')}</label>
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
            <label htmlFor="password">{t('auth.password')}</label>
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
            {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
          </button>
        </form>
      </div>
    </div>
  )
}

