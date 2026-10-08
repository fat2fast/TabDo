import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AccountDropdown } from '../AccountDropdown'
import { QuickLanguageButton } from '../QuickLanguageButton'
import { AuthProvider } from '../../auth/auth-provider'
import { I18nProvider } from '../../i18n/i18n-provider'
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

describe('AccountDropdown & QuickLanguageButton (UI/UX Pro Max)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  function renderDropdown(initialPath = '/dashboard', profileData = {
    id: 'user-1',
    role: 'admin',
    display_name: 'Phat Phan',
    timezone: 'Asia/Ho_Chi_Minh',
    locale: 'vi',
  }) {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: profileData.id, email: 'test@tabdo.dev' } } },
      error: null,
    } as any)

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: profileData,
        error: null,
      }),
    } as any)

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: null,
    } as any)

    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthProvider>
          <I18nProvider>
            <div className="topbar">
              <QuickLanguageButton />
              <AccountDropdown />
            </div>
            <Routes>
              <Route path="/dashboard" element={<div>User Dashboard</div>} />
              <Route path="/admin/dashboard" element={<div>Admin Dashboard</div>} />
              <Route path="/settings" element={<div>Settings Page</div>} />
            </Routes>
          </I18nProvider>
        </AuthProvider>
      </MemoryRouter>
    )
  }

  it('renders quick language button and toggles locale on click', async () => {
    const user = userEvent.setup()
    renderDropdown()

    const quickLangBtn = await screen.findByRole('button', { name: /chuyển sang english/i })
    expect(quickLangBtn).toBeInTheDocument()
    expect(quickLangBtn).toHaveTextContent('VI')

    await user.click(quickLangBtn)

    expect(quickLangBtn).toHaveTextContent('EN')
    expect(supabase.rpc).toHaveBeenCalledWith('update_my_profile', {
      new_display_name: 'Phat Phan',
      new_timezone: 'Asia/Ho_Chi_Minh',
      new_locale: 'en',
    })
  })

  it('opens dropdown menu on avatar click and displays user profile and options', async () => {
    const user = userEvent.setup()
    renderDropdown('/dashboard')

    // Find avatar button by title/initial
    const avatarBtn = await screen.findByRole('button', { name: /phat phan \(quản trị viên\)/i })
    expect(avatarBtn).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    // Click to open
    await user.click(avatarBtn)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // Check user info header
    expect(screen.getByText('Phat Phan')).toBeInTheDocument()
    expect(screen.getByText('test@tabdo.dev')).toBeInTheDocument()
    expect(screen.getByText('Quản trị viên')).toBeInTheDocument()

    // Check action items matching Image 2
    expect(screen.getByRole('menuitem', { name: /tài khoản & bảo mật/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /hướng dẫn sử dụng/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /cổng quản trị/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /đăng xuất/i })).toBeInTheDocument()
  })

  it('navigates to settings when clicking "Tài khoản & bảo mật"', async () => {
    const user = userEvent.setup()
    renderDropdown('/dashboard')

    const avatarBtn = await screen.findByRole('button', { name: /phat phan \(quản trị viên\)/i })
    await user.click(avatarBtn)

    const settingsItem = screen.getByRole('menuitem', { name: /tài khoản & bảo mật/i })
    await user.click(settingsItem)

    expect(await screen.findByText('Settings Page')).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('switches between Admin portal and User portal via portal switch item', async () => {
    const user = userEvent.setup()
    renderDropdown('/dashboard') // In user portal

    const avatarBtn = await screen.findByRole('button', { name: /phat phan \(quản trị viên\)/i })
    await user.click(avatarBtn)

    const portalSwitchItem = screen.getByRole('menuitem', { name: /cổng quản trị/i })
    await user.click(portalSwitchItem)

    expect(await screen.findByText('Admin Dashboard')).toBeInTheDocument()
  })

  it('shows "Cổng người dùng" when currently on an admin page', async () => {
    const user = userEvent.setup()
    renderDropdown('/admin/dashboard')

    const avatarBtn = await screen.findByRole('button', { name: /phat phan \(quản trị viên\)/i })
    await user.click(avatarBtn)

    const userPortalItem = screen.getByRole('menuitem', { name: /cổng người dùng/i })
    expect(userPortalItem).toBeInTheDocument()
    await user.click(userPortalItem)

    expect(await screen.findByText('User Dashboard')).toBeInTheDocument()
  })

  it('calls signOut when clicking "Đăng xuất" in dropdown', async () => {
    const user = userEvent.setup()
    renderDropdown('/dashboard')

    const avatarBtn = await screen.findByRole('button', { name: /phat phan \(quản trị viên\)/i })
    await user.click(avatarBtn)

    const logoutItem = screen.getByRole('menuitem', { name: /đăng xuất/i })
    await user.click(logoutItem)

    expect(supabase.auth.signOut).toHaveBeenCalled()
  })

  it('opens and closes User Guide modal when clicking "Hướng dẫn sử dụng"', async () => {
    const user = userEvent.setup()
    renderDropdown('/dashboard')

    const avatarBtn = await screen.findByRole('button', { name: /phat phan \(quản trị viên\)/i })
    await user.click(avatarBtn)

    const guideItem = screen.getByRole('menuitem', { name: /hướng dẫn sử dụng/i })
    await user.click(guideItem)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Hướng dẫn sử dụng TabDo')).toBeInTheDocument()

    const closeBtn = screen.getByRole('button', { name: /đã hiểu/i })
    await user.click(closeBtn)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
