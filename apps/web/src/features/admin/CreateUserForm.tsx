import React, { useState } from 'react'
import { useAdminCreateUser } from './api/admin-users'
import { useI18n } from '../i18n/i18n-provider'

interface CreatedUserResult {
  id: string
  email: string
  displayName: string | null
  role: string
  mustChangePassword?: boolean
  isActive?: boolean
}

export function CreateUserForm({
  onUserCreated,
  isModal = false,
  onClose,
}: {
  onUserCreated?: () => void
  isModal?: boolean
  onClose?: () => void
}) {
  const { t } = useI18n()
  const createUserMutation = useAdminCreateUser()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [initialPassword, setInitialPassword] = useState('')
  const [successResult, setSuccessResult] = useState<CreatedUserResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessResult(null)

    const trimmedEmail = email.trim()
    const trimmedDisplayName = displayName.trim()
    const trimmedPassword = initialPassword.trim()

    if (!trimmedEmail) {
      setErrorMessage(t('auth.invalidEmail'))
      return
    }

    if (trimmedPassword && trimmedPassword.length < 8) {
      setErrorMessage(t('admin.initialPasswordTooShort'))
      return
    }

    try {
      const data = await createUserMutation.mutateAsync({
        email: trimmedEmail,
        displayName: trimmedDisplayName || undefined,
        initialPassword: trimmedPassword || undefined,
      })

      setSuccessResult(data as CreatedUserResult)
      setDisplayName('')
      setEmail('')
      setInitialPassword('')
      onUserCreated?.()
    } catch (err: any) {
      setErrorMessage(err?.message || t('admin.createUserError'))
    }
  }

  const isSubmitting = createUserMutation.isPending

  return (
    <div className={isModal ? 'create-user-modal-body' : 'card create-user-card'}>
      {!isModal && (
        <div className="card-header">
          <h3 className="card-title">{t('admin.createUser')}</h3>
          <p className="card-subtitle">{t('admin.createUserDesc')}</p>
        </div>
      )}

      {successResult && (
        <div className="alert-success" role="status" style={{ marginTop: '1rem' }}>
          <strong>{t('admin.createSuccess')}</strong>
          <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
            <li>Email: {successResult.email}</li>
            {successResult.displayName && <li>{t('admin.fullName')}: {successResult.displayName}</li>}
            <li>{t('common.role')}: {t('admin.user')}</li>
          </ul>
        </div>
      )}

      {errorMessage && (
        <div className="alert-error" role="alert" style={{ marginTop: '1rem' }}>
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="admin-create-user-form" style={{ marginTop: '1rem' }}>
        <div className="form-group">
          <label htmlFor="create-display-name">{t('admin.displayName')}</label>
          <input
            id="create-display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Nguyễn Văn A"
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="create-email">{t('auth.email')} *</label>
          <input
            id="create-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="create-password">
            {t('admin.initialPasswordOptional')}
          </label>
          <input
            id="create-password"
            type="password"
            value={initialPassword}
            onChange={(e) => setInitialPassword(e.target.value)}
            placeholder={t('admin.initialPasswordPlaceholder')}
            autoComplete="new-password"
            disabled={isSubmitting}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: isModal ? 'flex-end' : 'flex-start', marginTop: '1.25rem' }}>
          {isModal && onClose && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ padding: '0.625rem 1.25rem', borderRadius: '8px' }}
            >
              {t('common.cancel')}
            </button>
          )}
          <button
            type="submit"
            className="admin-submit-button"
            disabled={isSubmitting}
            style={{ padding: '0.625rem 1.25rem', borderRadius: '8px' }}
          >
            {isSubmitting ? t('common.loading') : t('admin.createUserButton')}
          </button>
        </div>
      </form>
    </div>
  )
}
