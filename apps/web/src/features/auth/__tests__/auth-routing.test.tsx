import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { screen, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from '../../../app/App'
import { AuthProvider } from '../auth-provider'
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
      functions: {
        invoke: vi.fn(),
      },
      rpc: vi.fn(),
    },
  }
})

function renderAppWithProviders(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthProvider>
          <I18nProvider>
            <App />
          </I18nProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('auth-routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { users: [], total: 0, page: 1, pageSize: 10, totalPages: 1 },
      error: null,
    } as any)
  })

  it('redirects unauthenticated visitor from /dashboard to /login', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any)

    renderAppWithProviders('/dashboard')

    expect(await screen.findByRole('heading', { name: /đăng nhập tabdo/i })).toBeInTheDocument()
  })

  it('redirects unauthenticated visitor from /admin/users to /admin/login', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any)

    renderAppWithProviders('/admin/users')

    expect(await screen.findByRole('heading', { name: /đăng nhập quản trị viên/i })).toBeInTheDocument()
  })

  it('redirects non-admin user trying to access /admin/users to /dashboard with access denied', async () => {
    const mockUser = { id: 'user-1', email: 'user@example.com' }
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: mockUser } },
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

    renderAppWithProviders('/admin/users')

    expect(await screen.findByText(/bạn không có quyền truy cập khu vực quản trị/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /bảng điều khiển|dashboard/i })).toBeInTheDocument()
  })

  it('allows admin user to access /admin/users', async () => {
    const mockAdmin = { id: 'admin-1', email: 'admin@example.com' }
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: mockAdmin } },
      error: null,
    } as any)

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'admin-1',
          role: 'admin',
          display_name: 'Admin User',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        error: null,
      }),
    } as any)

    renderAppWithProviders('/admin/users')

    expect(await screen.findByRole('heading', { name: /quản lý người dùng/i })).toBeInTheDocument()
  })

  it('redirects forced user to /change-password', async () => {
    const mockUser = { id: 'forced-1', email: 'forced@example.com' }
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null,
    } as any)

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'forced-1',
          role: 'user',
          display_name: 'Forced User',
          timezone: 'Asia/Ho_Chi_Minh',
          is_active: true,
          must_change_password: true,
          locale: 'vi',
        },
        error: null,
      }),
    } as any)

    renderAppWithProviders('/dashboard')

    expect(await screen.findByRole('heading', { name: /đổi mật khẩu khởi tạo/i })).toBeInTheDocument()
  })

  it('renders disabled account message when user is inactive', async () => {
    const mockUser = { id: 'inactive-1', email: 'inactive@example.com' }
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null,
    } as any)

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'inactive-1',
          role: 'user',
          display_name: 'Inactive User',
          timezone: 'Asia/Ho_Chi_Minh',
          is_active: false,
          must_change_password: false,
          locale: 'vi',
        },
        error: null,
      }),
    } as any)

    renderAppWithProviders('/dashboard')

    expect(await screen.findByRole('heading', { name: /tài khoản đã bị vô hiệu hóa/i })).toBeInTheDocument()
  })
})
