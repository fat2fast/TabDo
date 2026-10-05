import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

describe('admin-create-user-form', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all form fields and submit button', () => {
    render(<CreateUserForm />)

    expect(screen.getByLabelText(/tên hiển thị/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/địa chỉ email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/mật khẩu khởi tạo/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tạo tài khoản/i })).toBeInTheDocument()
  })

  it('shows error if password is less than 8 characters', async () => {
    const user = userEvent.setup()
    render(<CreateUserForm />)

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

    render(<CreateUserForm />)

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

    expect(await screen.findByText(/tạo tài khoản thành công!/i)).toBeInTheDocument()
    expect(screen.getByText(/email: newuser@tabdo.local/i)).toBeInTheDocument()
    expect(screen.getByText(/họ tên: New Worker/i)).toBeInTheDocument()
  })

  it('displays error if email already exists (409 conflict)', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: {
        message: 'A user with this email address already exists.',
      },
    } as any)

    render(<CreateUserForm />)

    await user.type(screen.getByLabelText(/địa chỉ email/i), 'existing@tabdo.local')
    await user.type(screen.getByLabelText(/mật khẩu khởi tạo/i), 'password123')
    await user.click(screen.getByRole('button', { name: /tạo tài khoản/i }))

    expect(await screen.findByText(/a user with this email address already exists/i)).toBeInTheDocument()
  })
})
