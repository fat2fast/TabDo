import React from 'react'
import { AccountSettings } from '../features/settings/AccountSettings'

export function SettingsPage() {
  return (
    <div className="settings-page">
      <div className="page-header">
        <h2>Cài đặt tài khoản</h2>
      </div>
      <AccountSettings />
    </div>
  )
}
