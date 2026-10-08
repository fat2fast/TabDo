import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminUsersPage } from '../AdminUsersPage'
import { AuthProvider } from '../../features/auth/auth-provider'
import { I18nProvider } from '../../features/i18n/i18n-provider'
import { ConfirmProvider } from '../../components/ui/confirm-dialog'
import { supabase } from '../../lib/supabase'

vi.mock('../../lib/supabase', () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
      from: vi.fn(),
      functions: {
        invoke: vi.fn(),
      },
    },
  }
})

function renderUsersPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <I18nProvider>
          <ConfirmProvider>
            <AdminUsersPage />
          </ConfirmProvider>
        </I18nProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe('AdminUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'admin-current', email: 'admin@tabdo.local' } } },
      error: null,
    } as any)

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'admin-current',
          role: 'admin',
          display_name: 'Current Admin',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        error: null,
      }),
    } as any)
  })

  it('renders user list with task counts and badges', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        users: [
          {
            id: 'admin-current',
            email: 'admin@tabdo.local',
            displayName: 'Current Admin',
            role: 'admin',
            isActive: true,
            mustChangePassword: false,
            taskCount: 5,
            todoCount: 2,
            inProgressCount: 1,
            doneCount: 2,
          },
          {
            id: 'user-worker-1',
            email: 'worker@tabdo.local',
            displayName: 'Worker One',
            role: 'user',
            isActive: true,
            mustChangePassword: true,
            taskCount: 12,
            todoCount: 6,
            inProgressCount: 2,
            doneCount: 4,
          },
        ],
        total: 2,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      },
      error: null,
    } as any)

    renderUsersPage()

    expect(await screen.findByRole('heading', { name: /quản lý người dùng/i })).toBeInTheDocument()
    expect(screen.getByText('worker@tabdo.local')).toBeInTheDocument()
    expect(screen.getByText('Worker One')).toBeInTheDocument()
    expect(screen.getByText(/cần đổi mật khẩu/i)).toBeInTheDocument()

    // Current admin cannot be modified
    expect(screen.getByText(/tài khoản hiện tại/i)).toBeInTheDocument()

    // Normal user has "Khóa tài khoản" button
    expect(screen.getByRole('button', { name: /khóa tài khoản/i })).toBeInTheDocument()
  })

  it('triggers confirmation dialog and calls lifecycle deactivate', async () => {
    const user = userEvent.setup()

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        users: [
          {
            id: 'user-worker-2',
            email: 'worker2@tabdo.local',
            displayName: 'Worker Two',
            role: 'user',
            isActive: true,
            mustChangePassword: false,
            taskCount: 3,
            todoCount: 1,
            inProgressCount: 1,
            doneCount: 1,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      },
      error: null,
    } as any)

    renderUsersPage()

    const deactivateBtn = await screen.findByRole('button', { name: /khóa tài khoản/i })
    await user.click(deactivateBtn)

    // Confirm dialog appears
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/xác nhận vô hiệu hóa/i)).toBeInTheDocument()

    // Mock lifecycle response
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { ok: true, userId: 'user-worker-2', isActive: false },
      error: null,
    } as any)

    const confirmBtn = screen.getByTestId('confirm-dialog-btn')
    await user.click(confirmBtn)

    expect(supabase.functions.invoke).toHaveBeenCalledWith('admin-users', {
      body: { action: 'deactivate', userId: 'user-worker-2' },
    })

    expect(await screen.findByText(/đã vô hiệu hóa tài khoản worker2@tabdo.local thành công/i)).toBeInTheDocument()
  })

  it('opens and closes create user popup modal', async () => {
    const user = userEvent.setup()

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        users: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      },
      error: null,
    } as any)

    renderUsersPage()

    // Initially modal is not open
    expect(screen.queryByTestId('create-user-modal')).not.toBeInTheDocument()

    // Click "+ Cấp tài khoản mới"
    const openBtn = await screen.findByRole('button', { name: /cấp tài khoản mới/i })
    await user.click(openBtn)

    // Modal dialog is opened
    expect(screen.getByTestId('create-user-modal')).toBeInTheDocument()
    expect(screen.getByLabelText(/địa chỉ email/i)).toBeInTheDocument()

    // Click close button
    const closeBtn = screen.getByRole('button', { name: /đóng/i })
    await user.click(closeBtn)

    // Modal is dismissed
    expect(screen.queryByTestId('create-user-modal')).not.toBeInTheDocument()
  })
})
