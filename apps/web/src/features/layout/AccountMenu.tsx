import React from 'react'
import { useAuth } from '../auth/auth-provider'
import { useI18n } from '../i18n/i18n-provider'

export function AccountMenu() {
  const { user, profile, signOut } = useAuth()
  const { t } = useI18n()

  const displayName = profile?.displayName || user?.email?.split('@')[0] || t('admin.user')
  const roleLabel = profile?.role === 'admin' ? t('admin.adminRole') : t('admin.user')

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
        {t('nav.signOut')}
      </button>
    </div>
  )
}

