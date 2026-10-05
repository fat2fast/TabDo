import React, { useState } from 'react'
import { useAuth } from '../auth/auth-provider'
import { supabase } from '../../lib/supabase'

export function AccountSettings() {
  const { user, profile, refreshProfile, signOut } = useAuth()

  const [displayName, setDisplayName] = useState(profile?.displayName || '')
  const [timezone, setTimezone] = useState(profile?.timezone || 'Asia/Ho_Chi_Minh')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null)
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null)

  React.useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '')
      setTimezone(profile.timezone || 'Asia/Ho_Chi_Minh')
    }
  }, [profile])

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
      })

      if (error) {
        throw new Error(error.message)
      }

      await refreshProfile()
      setProfileSuccessMsg('Cập nhật thông tin thành công.')
    } catch (err: any) {
      setProfileErrorMsg(err?.message || 'Không thể cập nhật hồ sơ.')
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordSuccessMsg(null)
    setPasswordErrorMsg(null)

    if (newPassword.length < 8) {
      setPasswordErrorMsg('Mật khẩu mới phải có ít nhất 8 ký tự.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg('Mật khẩu xác nhận không khớp.')
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

      setPasswordSuccessMsg('Đổi mật khẩu thành công.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setPasswordErrorMsg(err?.message || 'Không thể cập nhật mật khẩu.')
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const roleLabel = profile?.role === 'admin' ? 'Quản trị viên' : 'Người dùng'

  return (
    <div className="account-settings-container">
      {/* Profile info & edit */}
      <div className="card settings-card">
        <h3>Thông tin tài khoản</h3>

        {profileSuccessMsg && (
          <div className="alert-success" role="status">
            {profileSuccessMsg}
          </div>
        )}
        {profileErrorMsg && (
          <div className="alert-error" role="alert">
            {profileErrorMsg}
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="settings-form">
          <div className="form-group">
            <label htmlFor="settings-email">Địa chỉ Email</label>
            <input
              id="settings-email"
              type="email"
              value={user?.email || ''}
              disabled
              className="input-disabled"
            />
          </div>

          <div className="form-group">
            <label>Vai trò</label>
            <div className="role-display">
              <span className="account-role-badge">{roleLabel}</span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="settings-display-name">Tên hiển thị</label>
            <input
              id="settings-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nhập tên hiển thị..."
              disabled={isUpdatingProfile}
            />
          </div>

          <div className="form-group">
            <label htmlFor="settings-timezone">Múi giờ</label>
            <select
              id="settings-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              disabled={isUpdatingProfile}
            >
              <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (GMT+7)</option>
              <option value="Asia/Bangkok">Asia/Bangkok (GMT+7)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (GMT+9)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>

          <button
            type="submit"
            className="settings-submit-button"
            disabled={isUpdatingProfile}
          >
            {isUpdatingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className="card settings-card">
        <h3>Đổi mật khẩu</h3>

        {passwordSuccessMsg && (
          <div className="alert-success" role="status">
            {passwordSuccessMsg}
          </div>
        )}
        {passwordErrorMsg && (
          <div className="alert-error" role="alert">
            {passwordErrorMsg}
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="settings-form">
          <div className="form-group">
            <label htmlFor="settings-new-password">Mật khẩu mới</label>
            <input
              id="settings-new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự"
              required
              minLength={8}
              autoComplete="new-password"
              disabled={isUpdatingPassword}
            />
          </div>

          <div className="form-group">
            <label htmlFor="settings-confirm-password">Xác nhận mật khẩu mới</label>
            <input
              id="settings-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
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
            {isUpdatingPassword ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
          </button>
        </form>
      </div>

      {/* Logout section */}
      <div className="card settings-card">
        <h3>Đăng xuất</h3>
        <p className="form-description">
          Đăng xuất khỏi phiên làm việc hiện tại trên cả Cổng người dùng và Cổng quản trị.
        </p>
        <button
          type="button"
          className="logout-button-danger"
          onClick={() => signOut()}
        >
          Đăng xuất khỏi thiết bị này
        </button>
      </div>
    </div>
  )
}
