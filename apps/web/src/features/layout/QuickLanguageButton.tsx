import React, { useState } from 'react'
import type { SupportedLocale } from '@tabdo/types'
import { useI18n } from '../i18n/i18n-provider'
import { useAuth } from '../auth/auth-provider'
import { supabase } from '../../lib/supabase'

export function QuickLanguageButton() {
  const { locale, setLocale } = useI18n()
  const { user, profile, refreshProfile } = useAuth()
  const [isSyncing, setIsSyncing] = useState(false)

  const nextLocale: SupportedLocale = locale === 'vi' ? 'en' : 'vi'
  const tooltip = locale === 'vi' ? 'Chuyển sang English' : 'Switch to Tiếng Việt'

  const handleToggleLanguage = async () => {
    setLocale(nextLocale)

    // Asynchronously update profile locale if user is logged in
    if (user && profile) {
      setIsSyncing(true)
      try {
        await supabase.rpc('update_my_profile', {
          new_display_name: profile.displayName || null,
          new_timezone: profile.timezone || 'Asia/Ho_Chi_Minh',
          new_locale: nextLocale,
        })
        await refreshProfile()
      } catch (err) {
        // Non-blocking error for local switch
        console.warn('Could not sync locale to remote profile:', err)
      } finally {
        setIsSyncing(false)
      }
    }
  }

  return (
    <button
      type="button"
      className="topbar-quick-lang-btn"
      onClick={handleToggleLanguage}
      title={tooltip}
      aria-label={tooltip}
      disabled={isSyncing}
    >
      <svg
        className="quick-lang-icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
      <span className="quick-lang-code">{locale.toUpperCase()}</span>
    </button>
  )
}
