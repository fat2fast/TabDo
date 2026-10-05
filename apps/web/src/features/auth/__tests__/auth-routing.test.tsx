import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App } from '../../../app/App'
import { AuthProvider } from '../auth-provider'
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

describe('auth-routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects unauthenticated visitor from /dashboard to /login', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any)

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )

    expect(await screen.findByRole('heading', { name: /đăng nhập tabdo/i })).toBeInTheDocument()
  })

  it('redirects unauthenticated visitor from /admin/users to /admin/login', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any)

    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )

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

    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )

    expect(await screen.findByText(/bạn không có quyền truy cập khu vực quản trị/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
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

    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )

    expect(await screen.findByRole('heading', { name: /quản lý người dùng/i })).toBeInTheDocument()
  })
})
