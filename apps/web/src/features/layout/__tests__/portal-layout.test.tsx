import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render as rtlRender, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { App } from '../../../app/App'
import { AuthProvider } from '../../auth/auth-provider'
import { supabase } from '../../../lib/supabase'

function render(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return rtlRender(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

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

  it('renders mobile navigation with active route indication', async () => {
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

    const mobileNav = await screen.findByTestId('mobile-bottom-nav')
    expect(mobileNav).toBeInTheDocument()

    const mobileDashboardLink = mobileNav.querySelector('a[href="/dashboard"]')
    expect(mobileDashboardLink).toBeInTheDocument()
    expect(mobileDashboardLink).toHaveClass('active')
  })

  it('opens More menu with user entries and no admin link for normal users', async () => {
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

    const moreBtn = await screen.findByTestId('mobile-nav-more-btn')
    await user.click(moreBtn)

    const sheet = await screen.findByTestId('mobile-more-sheet')
    expect(sheet).toBeInTheDocument()

    expect(within(sheet).getByRole('link', { name: /tổng kết|summary/i })).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: /báo cáo tháng|monthly report/i })).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: /cài đặt|settings/i })).toBeInTheDocument()
    expect(within(sheet).queryByRole('link', { name: /quản trị|admin/i })).not.toBeInTheDocument()
  })

  it('renders admin link in More menu for admin users', async () => {
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

    const moreBtn = await screen.findByTestId('mobile-nav-more-btn')
    await user.click(moreBtn)

    const sheet = await screen.findByTestId('mobile-more-sheet')
    expect(sheet).toBeInTheDocument()

    expect(within(sheet).getByRole('link', { name: /quản trị|admin/i })).toBeInTheDocument()
  })

  it('closes More menu on Escape and restores focus to More trigger button', async () => {
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

    const moreBtn = await screen.findByTestId('mobile-nav-more-btn')
    moreBtn.focus()
    await user.click(moreBtn)

    const sheet = await screen.findByTestId('mobile-more-sheet')
    expect(sheet).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByTestId('mobile-more-sheet')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(moreBtn)
  })

  it('cleans up body scroll lock and closes More menu when switching to desktop viewport', async () => {
    const user = userEvent.setup()

    let currentMatches = true
    const listeners = new Set<(e: MediaQueryListEvent) => void>()
    const mockMql = {
      get matches() {
        return currentMatches
      },
      media: '(max-width: 768px)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
        if (event === 'change') listeners.add(handler)
      }),
      removeEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
        if (event === 'change') listeners.delete(handler)
      }),
      dispatchEvent: vi.fn(),
    }

    const originalMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation(() => mockMql)
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 })

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

    const { unmount } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )

    // 1. Open More menu on mobile
    const moreBtn = await screen.findByTestId('mobile-nav-more-btn')
    await user.click(moreBtn)

    const sheet = await screen.findByTestId('mobile-more-sheet')
    expect(sheet).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')

    // 2. Resize Mobile -> Desktop (> 768px)
    act(() => {
      currentMatches = false
      window.innerWidth = 1024
      listeners.forEach((fn) => fn({ matches: false, media: '(max-width: 768px)' } as MediaQueryListEvent))
    })

    // 3. More menu must close and body scroll lock must be restored
    await waitFor(() => {
      expect(screen.queryByTestId('mobile-more-sheet')).not.toBeInTheDocument()
    })
    expect(document.body.style.overflow).toBe('')

    // 4. Resize back to Mobile and confirm More menu can reopen
    act(() => {
      currentMatches = true
      window.innerWidth = 390
      listeners.forEach((fn) => fn({ matches: true, media: '(max-width: 768px)' } as MediaQueryListEvent))
    })

    await user.click(moreBtn)
    expect(await screen.findByTestId('mobile-more-sheet')).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')

    unmount()
    window.matchMedia = originalMatchMedia
  })
})
