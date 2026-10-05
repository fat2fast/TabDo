import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface CreatedUserResult {
  id: string
  email: string
  displayName: string | null
  role: string
}

export function CreateUserForm() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [initialPassword, setInitialPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successResult, setSuccessResult] = useState<CreatedUserResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessResult(null)

    const trimmedEmail = email.trim()
    const trimmedDisplayName = displayName.trim()

    if (!trimmedEmail) {
      setErrorMessage('Vui lòng nhập địa chỉ email hợp lệ.')
      return
    }

    if (initialPassword.length < 8) {
      setErrorMessage('Mật khẩu khởi tạo phải có ít nhất 8 ký tự.')
      return
    }

    setIsSubmitting(true)

    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: trimmedEmail,
          displayName: trimmedDisplayName || undefined,
          initialPassword,
        },
      })

      if (error) {
        let msg = error.message
        // If error response body was returned
        if (typeof (error as any).context?.json === 'function') {
          try {
            const json = await (error as any).context.json()
            if (json?.error) msg = json.error
          } catch {
            // ignore
          }
        }
        setErrorMessage(msg || 'Không thể tạo tài khoản người dùng.')
        return
      }

      setSuccessResult(data as CreatedUserResult)
      // Reset form and clear password
      setDisplayName('')
      setEmail('')
      setInitialPassword('')
    } catch (err: any) {
      setErrorMessage(err?.message || 'Đã có lỗi xảy ra khi tạo người dùng.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="card create-user-card">
      <h3>Cấp tài khoản người dùng mới</h3>
      <p className="form-description">
        Tạo tài khoản người dùng thông thường. Mọi tài khoản mới được tạo sẽ tự động mang vai trò "Người dùng".
      </p>

      {successResult && (
        <div className="alert-success" role="status">
          <strong>Tạo tài khoản thành công!</strong>
          <ul>
            <li>Email: {successResult.email}</li>
            {successResult.displayName && <li>Họ tên: {successResult.displayName}</li>}
            <li>Vai trò: Người dùng</li>
          </ul>
        </div>
      )}

      {errorMessage && (
        <div className="alert-error" role="alert">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="admin-create-user-form">
        <div className="form-group">
          <label htmlFor="create-display-name">Tên hiển thị (tùy chọn)</label>
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
          <label htmlFor="create-email">Địa chỉ Email *</label>
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
          <label htmlFor="create-password">Mật khẩu khởi tạo * (tối thiểu 8 ký tự)</label>
          <input
            id="create-password"
            type="password"
            value={initialPassword}
            onChange={(e) => setInitialPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={8}
            autoComplete="new-password"
            disabled={isSubmitting}
          />
        </div>

        <button
          type="submit"
          className="admin-submit-button"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Đang tạo...' : 'Tạo tài khoản'}
        </button>
      </form>
    </div>
  )
}
