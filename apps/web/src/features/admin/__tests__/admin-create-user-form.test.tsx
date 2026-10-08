import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreateUserForm } from '../CreateUserForm'
import { supabase } from '../../../lib/supabase'

vi.mock('../../../lib/supabase', () => {
  return {
    supabase: {
      functions: {
        invoke: vi.fn(),
      },
    },
  }
})

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('admin-create-user-form', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all form fields and submit button', () => {
    renderWithClient(<CreateUserForm />)

    expect(screen.getByLabelText(/tên hiển thị/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/địa chỉ email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/mật khẩu khởi tạo/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tạo tài khoản/i })).toBeInTheDocument()
  })

  it('shows error if password is less than 8 characters', async () => {
    const user = userEvent.setup()
    renderWithClient(<CreateUserForm />)

    await user.type(screen.getByLabelText(/địa chỉ email/i), 'newuser@tabdo.local')
    await user.type(screen.getByLabelText(/mật khẩu khởi tạo/i), 'short')
    await user.click(screen.getByRole('button', { name: /tạo tài khoản/i }))

    expect(await screen.findByText(/mật khẩu khởi tạo phải có ít nhất 8 ký tự/i)).toBeInTheDocument()
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })

  it('submits form and displays success on valid admin invocation', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        id: 'new-user-123',
        email: 'newuser@tabdo.local',
        displayName: 'New Worker',
        role: 'user',
      },
      error: null,
    } as any)

    renderWithClient(<CreateUserForm />)

    await user.type(screen.getByLabelText(/tên hiển thị/i), 'New Worker')
    await user.type(screen.getByLabelText(/địa chỉ email/i), 'newuser@tabdo.local')
    await user.type(screen.getByLabelText(/mật khẩu khởi tạo/i), 'password123')
    await user.click(screen.getByRole('button', { name: /tạo tài khoản/i }))

    expect(supabase.functions.invoke).toHaveBeenCalledWith('admin-create-user', {
      body: {
        email: 'newuser@tabdo.local',
        displayName: 'New Worker',
        initialPassword: 'password123',
      },
    })

    expect(await screen.findByText(/cấp tài khoản thành công!/i)).toBeInTheDocument()
    expect(screen.getByText(/email: newuser@tabdo.local/i)).toBeInTheDocument()
    expect(screen.getByText(/họ tên: New Worker/i)).toBeInTheDocument()
  })

  it('omits initialPassword when left blank to allow system default password resolution', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        id: 'default-user-456',
        email: 'default@tabdo.local',
        displayName: 'Default Worker',
        role: 'user',
      },
      error: null,
    } as any)

    renderWithClient(<CreateUserForm />)

    await user.type(screen.getByLabelText(/tên hiển thị/i), 'Default Worker')
    await user.type(screen.getByLabelText(/địa chỉ email/i), 'default@tabdo.local')
    // Leave password empty
    await user.click(screen.getByRole('button', { name: /tạo tài khoản/i }))

    expect(supabase.functions.invoke).toHaveBeenCalledWith('admin-create-user', {
      body: {
        email: 'default@tabdo.local',
        displayName: 'Default Worker',
      },
    })

    expect(await screen.findByText(/cấp tài khoản thành công!/i)).toBeInTheDocument()
  })

  it('displays error if email already exists (409 conflict)', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: {
        message: 'A user with this email address already exists.',
      },
    } as any)

    renderWithClient(<CreateUserForm />)

    await user.type(screen.getByLabelText(/địa chỉ email/i), 'existing@tabdo.local')
    await user.type(screen.getByLabelText(/mật khẩu khởi tạo/i), 'password123')
    await user.click(screen.getByRole('button', { name: /tạo tài khoản/i }))

    expect(await screen.findByText(/a user with this email address already exists/i)).toBeInTheDocument()
  })
})
