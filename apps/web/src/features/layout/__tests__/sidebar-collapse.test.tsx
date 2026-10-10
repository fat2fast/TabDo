import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { App } from '../../../app/App'
import { AuthProvider } from '../../auth/auth-provider'
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

describe('Sidebar collapse and version display', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

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
  })

  it('renders sidebar with collapse button and version footer in expanded mode', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )

    const collapseBtn = await screen.findByTestId('sidebar-collapse-btn')
    expect(collapseBtn).toBeInTheDocument()
    expect(collapseBtn).toHaveTextContent(/thu gọn thanh bên|collapse sidebar/i)

    const versionFooter = screen.getByTestId('sidebar-version-footer')
    expect(versionFooter).toBeInTheDocument()
    expect(versionFooter.textContent).toContain(BUILD_INFO_STRING)
  })

  it('toggles sidebar collapsed state and persists in localStorage', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )

    const collapseBtn = await screen.findByTestId('sidebar-collapse-btn')
    await user.click(collapseBtn)

    // Should now be collapsed: collapse button gone, expand button visible
    expect(screen.queryByTestId('sidebar-collapse-btn')).not.toBeInTheDocument()
    const expandBtn = screen.getByTestId('sidebar-expand-btn')
    expect(expandBtn).toBeInTheDocument()
    expect(localStorage.getItem('tabdo:sidebar:collapsed')).toBe('true')

    // Click expand button to restore
    await user.click(expandBtn)
    expect(screen.getByTestId('sidebar-collapse-btn')).toBeInTheDocument()
    expect(localStorage.getItem('tabdo:sidebar:collapsed')).toBe('false')
  })

  it('initializes in collapsed state when localStorage has tabdo:sidebar:collapsed = true', async () => {
    localStorage.setItem('tabdo:sidebar:collapsed', 'true')

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )

    const expandBtn = await screen.findByTestId('sidebar-expand-btn')
    expect(expandBtn).toBeInTheDocument()
    expect(screen.queryByTestId('sidebar-collapse-btn')).not.toBeInTheDocument()
  })
})
