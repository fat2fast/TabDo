import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from '../../../pages/LoginPage'
import { AdminLoginPage } from '../../../pages/AdminLoginPage'
import { AuthProvider } from '../auth-provider'
import { supabase } from '../../../lib/supabase'
import { BUILD_INFO_STRING } from '../../../lib/build-info'

function render(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return rtlRender(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

vi.mock('../../../lib/supabase', () => ({
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
}))

describe('LoginForm version footer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any)
  })

  it('renders build info footer in user login page', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    )

    const footer = await screen.findByTestId('login-version-footer')
    expect(footer).toBeInTheDocument()
    expect(footer.textContent).toContain(BUILD_INFO_STRING)
  })

  it('renders build info footer in admin login page', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/login']}>
        <AuthProvider>
          <AdminLoginPage />
        </AuthProvider>
      </MemoryRouter>
    )

    const footer = await screen.findByTestId('login-version-footer')
    expect(footer).toBeInTheDocument()
    expect(footer.textContent).toContain(BUILD_INFO_STRING)
  })
})
