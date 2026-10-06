import React from 'react'
import { formatReminderDisplay } from '@tabdo/utils'
import type { ExtensionAuthUser, ExtensionSyncMetadata } from '../lib/types.js'

interface SettingsViewProps {
  user: ExtensionAuthUser
  syncMetadata: ExtensionSyncMetadata
  onSync: () => Promise<void>
  onSignOut: () => Promise<void>
  onOpenWebApp: () => void
  onBack: () => void
  isSyncing?: boolean
  isSigningOut?: boolean
}

export function SettingsView({
  user,
  syncMetadata,
  onSync,
  onSignOut,
  onOpenWebApp,
  onBack,
  isSyncing = false,
  isSigningOut = false,
}: SettingsViewProps) {
  const formattedSyncTime = syncMetadata.lastSuccessfulSyncAt
  ? formatReminderDisplay(syncMetadata.lastSuccessfulSyncAt, user.timezone)
  : 'Chưa đồng bộ'

  const userInitial = (user.displayName || user.email || 'U').charAt(0).toUpperCase()

  return (
    <div className="tabdo-view settings-view">
      {/* Header */}
      <div className="tabdo-header">
        <div className="tabdo-header-row">
          <h2 className="tabdo-view-title">Cài đặt kết nối</h2>
          <button
            type="button"
            onClick={onBack}
            className="tabdo-btn tabdo-btn-secondary tabdo-btn-sm"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Quay lại</span>
          </button>
        </div>
      </div>

      <div className="tabdo-settings-content">
        {/* Account Profile Card */}
        <div className="tabdo-settings-group">
          <div className="tabdo-settings-group-header">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="tabdo-group-icon"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <h3 className="tabdo-settings-heading">Tài khoản</h3>
          </div>
          <div className="tabdo-profile-card">
            <div className="tabdo-avatar">{userInitial}</div>
            <div className="tabdo-profile-info">
              <div className="tabdo-profile-name">{user.displayName || 'Người dùng TabDo'}</div>
              <div className="tabdo-profile-email" data-testid="settings-email">{user.email}</div>
            </div>
          </div>
          <div className="tabdo-info-row">
            <span className="tabdo-info-label">Múi giờ:</span>
            <span className="tabdo-info-value" data-testid="settings-timezone">{user.timezone}</span>
          </div>
        </div>

        {/* Sync Status Card */}
        <div className="tabdo-settings-group">
          <div className="tabdo-settings-group-header">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="tabdo-group-icon"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
            <h3 className="tabdo-settings-heading">Trạng thái đồng bộ</h3>
          </div>
          <div className="tabdo-info-row">
            <span className="tabdo-info-label">Lần cuối:</span>
            <span className="tabdo-info-value" data-testid="settings-last-sync">
              <span className="tabdo-sync-dot"></span>
              {formattedSyncTime}
            </span>
          </div>

          {syncMetadata.lastSyncError && (
            <div className="tabdo-alert tabdo-alert-danger" role="alert" data-testid="settings-sync-error">
              Lỗi: {syncMetadata.lastSyncError}
            </div>
          )}
          {syncMetadata.isStale && !syncMetadata.lastSyncError && (
            <div className="tabdo-alert tabdo-alert-warning" role="status">
              Dữ liệu đang xem có thể chưa được cập nhật mới nhất.
            </div>
          )}

          <div className="tabdo-field-actions">
            <button
              type="button"
              onClick={onSync}
              disabled={isSyncing}
              className="tabdo-btn tabdo-btn-primary tabdo-btn-block"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={isSyncing ? 'tabdo-spin' : ''}
              >
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 21h5v-5" />
              </svg>
              <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}</span>
            </button>
          </div>
        </div>

        {/* Quick Actions & Logout */}
        <div className="tabdo-settings-group">
          <div className="tabdo-settings-group-header">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="tabdo-group-icon"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <h3 className="tabdo-settings-heading">Thao tác</h3>
          </div>
          <button
            type="button"
            onClick={onOpenWebApp}
            className="tabdo-btn tabdo-btn-secondary tabdo-btn-block tabdo-mb-2"
          >
            <span>Mở TabDo Web</span>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onSignOut}
            disabled={isSigningOut}
            className="tabdo-btn tabdo-btn-soft-danger tabdo-btn-block"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>{isSigningOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
