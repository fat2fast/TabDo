import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountSettings } from '../AccountSettings'
import { AuthProvider } from '../../auth/auth-provider'
import { supabase } from '../../../lib/supabase'

vi.mock('../../../lib/supabase', () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        updateUser: vi.fn(),
      },
      from: vi.fn(),
      functions: { invoke: vi.fn() },
      rpc: vi.fn(),
    },
  }
})

describe('account-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders own profile details and role is read-only', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'u-1', email: 'user@tabdo.local' } } },
      error: null,
    } as any)

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'u-1',
          role: 'user',
          display_name: 'Minh Phat',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        error: null,
      }),
    } as any)

    render(
      <AuthProvider>
        <AccountSettings />
      </AuthProvider>
    )

    expect(await screen.findByDisplayValue('user@tabdo.local')).toBeDisabled()
    expect(await screen.findByDisplayValue('Minh Phat')).toBeInTheDocument()
    expect(screen.getByText('Người dùng')).toBeInTheDocument()

    // Assert there is no role input or select
    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/vai trò/i)).not.toBeInTheDocument()
  })

  it('updates display name via update_my_profile RPC', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'u-1', email: 'user@tabdo.local' } } },
      error: null,
    } as any)

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'u-1',
          role: 'user',
          display_name: 'Minh Phat',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        error: null,
      }),
    } as any)

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: null,
    } as any)

    render(
      <AuthProvider>
        <AccountSettings />
      </AuthProvider>
    )

    const nameInput = await screen.findByDisplayValue('Minh Phat')
    await user.clear(nameInput)
    await user.type(nameInput, 'Phat Phan')

    const saveButton = screen.getByRole('button', { name: /lưu thay đổi/i })
    await user.click(saveButton)

    expect(supabase.rpc).toHaveBeenCalledWith('update_my_profile', {
      new_display_name: 'Phat Phan',
      new_timezone: 'Asia/Ho_Chi_Minh',
      new_locale: 'vi',
    })

    expect(await screen.findByText(/cập nhật thông tin thành công/i)).toBeInTheDocument()
  })

  it('updates password via supabase.auth.updateUser', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'u-1', email: 'user@tabdo.local' } } },
      error: null,
    } as any)

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'u-1',
          role: 'user',
          display_name: 'Minh Phat',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        error: null,
      }),
    } as any)

    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: {} },
      error: null,
    } as any)

    render(
      <AuthProvider>
        <AccountSettings />
      </AuthProvider>
    )

    const securityTab = await screen.findByRole('tab', { name: /đổi mật khẩu/i })
    await user.click(securityTab)

    const newPassInput = await screen.findByLabelText(/^mật khẩu mới/i)
    const confirmPassInput = screen.getByLabelText(/xác nhận mật khẩu mới/i)

    await user.type(newPassInput, 'newsecret123')
    await user.type(confirmPassInput, 'newsecret123')

    const changePassButton = screen.getByRole('button', { name: /đổi mật khẩu/i })
    await user.click(changePassButton)

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      password: 'newsecret123',
    })

    expect(await screen.findByText(/đổi mật khẩu thành công/i)).toBeInTheDocument()
  })
})
