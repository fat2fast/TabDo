import React from 'react'
import { AccountSettings } from '../features/settings/AccountSettings'
import { PwaSettingsCard } from '../features/pwa/pwa-settings-card'

export function SettingsPage() {
  return (
    <div className="settings-page">
      <AccountSettings />
      <PwaSettingsCard />
    </div>
  )
}

