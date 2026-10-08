import React from 'react'
import { AccountSettings } from '../features/settings/AccountSettings'
import { useI18n } from '../features/i18n/i18n-provider'

export function SettingsPage() {
  return (
    <div className="settings-page">
      <AccountSettings />
    </div>
  )
}

