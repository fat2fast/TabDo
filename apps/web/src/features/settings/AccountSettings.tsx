import React, { useState } from 'react'
import type { SupportedLocale } from '@tabdo/types'
import { useAuth } from '../auth/auth-provider'
import { useI18n } from '../i18n/i18n-provider'
import { supabase } from '../../lib/supabase'
import { CustomDropdown } from '../../components/ui/custom-dropdown'

export function AccountSettings() {
  const { user, profile, refreshProfile } = useAuth()
  const { locale, setLocale, t } = useI18n()

  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile')

  const [displayName, setDisplayName] = useState(profile?.displayName || '')
  const [timezone, setTimezone] = useState(profile?.timezone || 'Asia/Ho_Chi_Minh')
  const [selectedLocale, setSelectedLocale] = useState<SupportedLocale>(profile?.locale || locale || 'vi')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null)
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null)

  React.useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '')
      setTimezone(profile.timezone || 'Asia/Ho_Chi_Minh')
      setSelectedLocale(profile.locale || locale || 'vi')
    }
  }, [profile])

  React.useEffect(() => {
    if (locale) {
      setSelectedLocale(locale)
    }
  }, [locale])

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null)
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null)

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileSuccessMsg(null)
    setProfileErrorMsg(null)
    setIsUpdatingProfile(true)

    try {
      const { error } = await supabase.rpc('update_my_profile', {
        new_display_name: displayName.trim() || null,
        new_timezone: timezone.trim() || 'Asia/Ho_Chi_Minh',
        new_locale: selectedLocale,
      })

      if (error) {
        throw new Error(error.message)
      }

      setLocale(selectedLocale)
      await refreshProfile()
      setProfileSuccessMsg(t('settings.saveSuccess'))
    } catch (err: any) {
      setProfileErrorMsg(err?.message || t('settings.profileUpdateError'))
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordSuccessMsg(null)
    setPasswordErrorMsg(null)

    if (newPassword.length < 8) {
      setPasswordErrorMsg(t('auth.passwordTooShort'))
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg(t('auth.passwordMismatch'))
      return
    }

    setIsUpdatingPassword(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        throw new Error(error.message)
      }

      setPasswordSuccessMsg(t('settings.passwordChangeSuccess'))
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setPasswordErrorMsg(err?.message || t('settings.passwordUpdateError'))
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const roleLabel = profile?.role === 'admin' ? t('admin.adminRole') : t('admin.user')

  return (
    <div className="account-settings-container">
      <div className="settings-page-header" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
          {t('settings.title')}
        </h2>
        <p style={{ margin: '0.35rem 0 0 0', color: '#64748b', fontSize: '0.9375rem' }}>
          {t('settings.subtitle')}
        </p>
      </div>

      {/* Tabs navigation */}
      <div className="settings-tabs-nav" role="tablist" aria-label={t('settings.title')}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'profile'}
          className={`settings-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>{t('settings.tabProfile')}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'security'}
          className={`settings-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>{t('settings.tabSecurity')}</span>
        </button>
      </div>

      {/* Tab 1: Profile Info */}
      {activeTab === 'profile' && (
        <div className="card settings-card" role="tabpanel" aria-label={t('settings.tabProfile')}>
          <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.15rem', fontWeight: 700, color: '#1e293b' }}>
            {t('settings.profileSection')}
          </h3>

          {profileSuccessMsg && (
            <div className="alert-success" role="status" style={{ marginBottom: '1.25rem' }}>
              {profileSuccessMsg}
            </div>
          )}
          {profileErrorMsg && (
            <div className="alert-error" role="alert" style={{ marginBottom: '1.25rem' }}>
              {profileErrorMsg}
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="settings-form">
            <div className="form-group">
              <label htmlFor="settings-email">{t('auth.email')}</label>
              <input
                id="settings-email"
                type="email"
                value={user?.email || ''}
                disabled
                className="input-disabled"
              />
            </div>

            <div className="form-group">
              <label>{t('settings.currentRole')}</label>
              <div className="role-display">
                <span className={`account-role-badge ${profile?.role === 'admin' ? 'admin-badge' : 'user-badge'}`}>
                  {roleLabel}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="settings-display-name">{t('settings.displayNameLabel')}</label>
              <input
                id="settings-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('settings.placeholderDisplayName')}
                disabled={isUpdatingProfile}
              />
            </div>

            <div className="form-group">
              <label htmlFor="settings-timezone">{t('settings.timezoneLabel')}</label>
              <CustomDropdown<string>
                id="settings-timezone"
                value={timezone}
                onChange={(val) => setTimezone(val)}
                disabled={isUpdatingProfile}
                options={[
                  { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh (GMT+7)' },
                  { value: 'Asia/Bangkok', label: 'Asia/Bangkok (GMT+7)' },
                  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (GMT+9)' },
                  { value: 'UTC', label: 'UTC' },
                ]}
              />
            </div>

            <div className="form-group">
              <label htmlFor="settings-language">{t('settings.languageLabel')}</label>
              <CustomDropdown<SupportedLocale>
                id="settings-language"
                value={selectedLocale}
                onChange={(next) => {
                  setSelectedLocale(next)
                  setLocale(next)
                }}
                disabled={isUpdatingProfile}
                options={[
                  { value: 'vi', label: t('settings.languageVi') },
                  { value: 'en', label: t('settings.languageEn') },
                ]}
              />
            </div>

            <button
              type="submit"
              className="settings-submit-button"
              disabled={isUpdatingProfile}
            >
              {isUpdatingProfile ? t('common.saving') : t('common.save')}
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Security & Password */}
      {activeTab === 'security' && (
        <div className="card settings-card" role="tabpanel" aria-label={t('settings.tabSecurity')}>
          <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.15rem', fontWeight: 700, color: '#1e293b' }}>
            {t('settings.changePasswordSection')}
          </h3>

          {passwordSuccessMsg && (
            <div className="alert-success" role="status" style={{ marginBottom: '1.25rem' }}>
              {passwordSuccessMsg}
            </div>
          )}
          {passwordErrorMsg && (
            <div className="alert-error" role="alert" style={{ marginBottom: '1.25rem' }}>
              {passwordErrorMsg}
            </div>
          )}

          <form onSubmit={handleUpdatePassword} className="settings-form">
            <div className="form-group">
              <label htmlFor="settings-new-password">{t('auth.newPassword')}</label>
              <input
                id="settings-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('settings.placeholderMinPass')}
                required
                minLength={8}
                autoComplete="new-password"
                disabled={isUpdatingPassword}
              />
            </div>

            <div className="form-group">
              <label htmlFor="settings-confirm-password">{t('auth.confirmPassword')}</label>
              <input
                id="settings-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('settings.placeholderConfirmPass')}
                required
                minLength={8}
                autoComplete="new-password"
                disabled={isUpdatingPassword}
              />
            </div>

            <button
              type="submit"
              className="settings-submit-button"
              disabled={isUpdatingPassword}
            >
              {isUpdatingPassword ? t('common.saving') : t('settings.changePasswordButton')}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
