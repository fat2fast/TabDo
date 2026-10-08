import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { App } from '../../../app/App'
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

describe('portal-layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders "Quản trị" link for admin users in user portal', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'admin-1', email: 'admin@tabdo.local' } } },
      error: null,
    } as any)

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'admin-1',
          role: 'admin',
          display_name: 'Admin Boss',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        error: null,
      }),
    } as any)

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )

    expect(await screen.findByRole('link', { name: /quản trị/i })).toBeInTheDocument()
    const avatarBtn = screen.getByTestId('topbar-avatar-btn')
    await user.click(avatarBtn)
    expect(screen.getByText('Quản trị viên')).toBeInTheDocument()
  })

  it('hides "Quản trị" link for normal users', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'user-1', email: 'user@tabdo.local' } } },
      error: null,
    } as any)

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'user-1',
          role: 'user',
          display_name: 'Regular User',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        error: null,
      }),
    } as any)

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )

    await screen.findByRole('heading', { name: /bảng điều khiển|dashboard/i })
    expect(screen.queryByRole('link', { name: /quản trị/i })).not.toBeInTheDocument()
    const avatarBtn = screen.getByTestId('topbar-avatar-btn')
    await user.click(avatarBtn)
    expect(screen.getByText('Người dùng')).toBeInTheDocument()
  })

  it('calls signOut when logout button is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'user-1', email: 'user@tabdo.local' } } },
      error: null,
    } as any)

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'user-1',
          role: 'user',
          display_name: 'Regular User',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        error: null,
      }),
    } as any)

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )

    const avatarBtn = await screen.findByTestId('topbar-avatar-btn')
    await user.click(avatarBtn)
    const logoutButton = await screen.findByRole('menuitem', { name: /đăng xuất/i })
    await user.click(logoutButton)

    expect(supabase.auth.signOut).toHaveBeenCalled()
  })
})
