import React, { useEffect, useState } from 'react'
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
  const [isPillEnabled, setIsPillEnabled] = useState(false)
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function checkPillStatus() {
      if (typeof chrome === 'undefined') return
      try {
        const hasPerm = chrome.permissions?.contains
          ? (await chrome.permissions.contains({ origins: ['*://*/*'] }).catch(() => false))
            || (await chrome.permissions.contains({ origins: ['https://*/*', 'http://*/*'] }).catch(() => false))
          : false
        const stored = chrome.storage?.local?.get
          ? await chrome.storage.local.get('quickPillEnabled')
          : {}

        // If permission has been granted, default to enabled unless explicitly turned off
        const isEnabled = Boolean(hasPerm && stored?.quickPillEnabled !== false)
        if (mounted) {
          setIsPillEnabled(isEnabled)
        }
        if (hasPerm && stored?.quickPillEnabled !== isEnabled && chrome.storage?.local?.set) {
          await chrome.storage.local.set({ quickPillEnabled: isEnabled })
        }
      } catch {
        // ignore in non-extension environment
      }
    }
    checkPillStatus()
    return () => {
      mounted = false
    }
  }, [])

  const handleTogglePill = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.checked
    setPermissionError(null)

    if (nextVal) {
      // Optimistically flip the switch so UI reflects state immediately
      setIsPillEnabled(true)
      setIsRequestingPermission(true)
      try {
        if (typeof chrome !== 'undefined' && chrome.permissions?.request) {
          // Pre-save enabled in storage so if popup closes due to browser prompt blur,
          // it stays enabled upon reopening
          if (chrome.storage?.local?.set) {
            await chrome.storage.local.set({ quickPillEnabled: true })
          }

          let granted = false
          try {
            granted = await chrome.permissions.request({
              origins: ['*://*/*'],
            })
          } catch (requestErr: any) {
            // Fallback in case specific Chromium versions require explicit schemes
            try {
              granted = await chrome.permissions.request({
                origins: ['https://*/*', 'http://*/*'],
              })
            } catch {
              throw requestErr
            }
          }

          if (granted) {
            setIsPillEnabled(true)
            if (chrome.runtime?.sendMessage) {
              chrome.runtime.sendMessage({
                type: 'tabdo:sync-pill-script',
                payload: { enabled: true },
              }).catch(() => {})
            }
          } else {
            // User declined/dismissed prompt
            setIsPillEnabled(false)
            if (chrome.storage?.local?.set) {
              await chrome.storage.local.set({ quickPillEnabled: false })
            }
          }
        } else {
          setIsPillEnabled(true)
        }
      } catch (err: any) {
        setPermissionError(err?.message || 'Không thể yêu cầu quyền truy cập')
        setIsPillEnabled(false)
        if (typeof chrome !== 'undefined' && chrome.storage?.local?.set) {
          await chrome.storage.local.set({ quickPillEnabled: false })
        }
      } finally {
        setIsRequestingPermission(false)
      }
    } else {
      setIsPillEnabled(false)
      if (typeof chrome !== 'undefined') {
        if (chrome.storage?.local?.set) {
          await chrome.storage.local.set({ quickPillEnabled: false })
        }
        if (chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({
            type: 'tabdo:sync-pill-script',
            payload: { enabled: false },
          }).catch(() => {})
        }
        // Completely revoke all granted host origins
        try {
          if (chrome.permissions?.getAll) {
            const current = await chrome.permissions.getAll()
            const wildcardOrigins = (current.origins || []).filter((o) => o.includes('*'))
            if (wildcardOrigins.length > 0 && chrome.permissions.remove) {
              await chrome.permissions.remove({ origins: wildcardOrigins })
            }
          }
          if (chrome.permissions?.remove) {
            await chrome.permissions.remove({ origins: ['*://*/*'] }).catch(() => {})
            await chrome.permissions.remove({ origins: ['https://*/*', 'http://*/*'] }).catch(() => {})
          }
        } catch {
          // ignore
        }
      }
    }
  }

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

        {/* Web Companion / Floating Pill Settings */}
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
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <h3 className="tabdo-settings-heading">Tiện ích duyệt web</h3>
          </div>

          <div className="tabdo-toggle-row">
            <div className="tabdo-toggle-info">
              <div className="tabdo-toggle-title">Nút tạo việc khi quét văn bản</div>
              <div className="tabdo-toggle-desc">
                Tự động hiển thị nút TabDo nổi khi bạn bôi đen chữ trên trang web để tạo việc nhanh.
              </div>
              <div className={`tabdo-permission-status ${isPillEnabled ? 'active' : 'inactive'}`}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: isPillEnabled ? 'var(--success)' : '#94a3b8',
                  }}
                />
                <span>{isPillEnabled ? 'Đang bật (đã cấp quyền)' : 'Đang tắt (hỏi quyền khi bật)'}</span>
              </div>
            </div>

            <label className="tabdo-switch" aria-label="Bật icon tạo việc khi quét văn bản">
              <input
                type="checkbox"
                checked={isPillEnabled}
                onChange={handleTogglePill}
                disabled={isRequestingPermission}
                data-testid="toggle-quick-pill"
              />
              <span className="tabdo-switch-slider" />
            </label>
          </div>

          {permissionError && (
            <div className="tabdo-alert tabdo-alert-danger" role="alert" style={{ marginTop: '6px' }}>
              {permissionError}
            </div>
          )}
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
