import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { App } from '../App.js'
import type { ExtensionMessage, ExtensionResult, ExtensionState } from '../../../lib/types.js'

describe('Popup App state machine', () => {
  let messageHandler: (msg: ExtensionMessage) => Promise<ExtensionResult>

  beforeEach(() => {
    const chromeMock = {
      runtime: {
        lastError: null,
        sendMessage: vi.fn((message: ExtensionMessage, callback: (res: unknown) => void) => {
          messageHandler(message).then((res) => callback?.(res))
        }),
      },
      tabs: {
        create: vi.fn(),
      },
      permissions: {
        contains: vi.fn().mockResolvedValue(false),
        request: vi.fn().mockResolvedValue(true),
        remove: vi.fn().mockResolvedValue(true),
      },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.stubGlobal('chrome', chromeMock as any)
  })

  it('1. signed-out: renders sign-in form when unauthenticated', async () => {
    messageHandler = async (msg) => {
      if (msg.type === 'get-state') {
        return {
          ok: true,
          data: {
            status: 'unauthenticated',
            user: null,
            todayTasks: [],
            syncMetadata: { lastSuccessfulSyncAt: null, lastSyncError: null, isStale: false },
          } as ExtensionState,
        }
      }
      return { ok: true, data: null }
    }

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'TabDo' })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/mật khẩu/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument()
  })

  it('2. failed-login: displays error when credentials fail', async () => {
    messageHandler = async (msg) => {
      if (msg.type === 'get-state') {
        return {
          ok: true,
          data: {
            status: 'unauthenticated',
            user: null,
            todayTasks: [],
            syncMetadata: { lastSuccessfulSyncAt: null, lastSyncError: null, isStale: false },
          } as ExtensionState,
        }
      }
      if (msg.type === 'sign-in') {
        return { ok: false, error: 'Sai tài khoản hoặc mật khẩu' }
      }
      return { ok: true, data: null }
    }

    const user = userEvent.setup()
    render(<App />)

    const emailInput = await screen.findByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/mật khẩu/i)
    const submitBtn = screen.getByRole('button', { name: 'Đăng nhập' })

    await user.type(emailInput, 'wrong@example.com')
    await user.type(passwordInput, 'wrongpassword')
    await user.click(submitBtn)

    expect(await screen.findByRole('alert')).toHaveTextContent('Sai tài khoản hoặc mật khẩu')
  })

  it('3. authenticated settings: displays user metadata and allows sign-out', async () => {
    let signedOutCalled = false

    messageHandler = async (msg) => {
      if (msg.type === 'get-state') {
        return {
          ok: true,
          data: {
            status: 'authenticated',
            user: {
              id: 'user-1',
              email: 'phat@example.com',
              displayName: 'Phat Phung',
              timezone: 'Asia/Ho_Chi_Minh',
              isActive: true,
              mustChangePassword: false,
              locale: 'vi',
            },
            todayTasks: [],
            syncMetadata: {
              lastSuccessfulSyncAt: '2026-10-06T10:00:00.000Z',
              lastSyncError: null,
              isStale: false,
            },
          } as ExtensionState,
        }
      }
      if (msg.type === 'sign-out') {
        signedOutCalled = true
        return { ok: true, data: null }
      }
      return { ok: true, data: null }
    }

    const user = userEvent.setup()
    render(<App />)

    // Initially loads Today
    expect(await screen.findByRole('heading', { name: 'Hôm nay' })).toBeInTheDocument()

    // Go to settings
    const settingsBtn = screen.getByLabelText('Cài đặt')
    await user.click(settingsBtn)

    expect(await screen.findByRole('heading', { name: 'Cài đặt kết nối' })).toBeInTheDocument()
    expect(screen.getByTestId('settings-email')).toHaveTextContent('phat@example.com')
    expect(screen.getByTestId('settings-timezone')).toHaveTextContent('Asia/Ho_Chi_Minh')

    // Click Sign Out
    const signOutBtn = screen.getByRole('button', { name: 'Đăng xuất' })
    await user.click(signOutBtn)

    await waitFor(() => {
      expect(signedOutCalled).toBe(true)
    })
    expect(await screen.findByRole('heading', { name: 'TabDo' })).toBeInTheDocument()
  })

  it('4. companion toggle: requests permission and saves setting when enabled', async () => {
    messageHandler = async (msg) => {
      if (msg.type === 'get-state') {
        return {
          ok: true,
          data: {
            status: 'authenticated',
            user: {
              id: 'user-1',
              email: 'phat@example.com',
              displayName: 'Phat Phung',
              timezone: 'Asia/Ho_Chi_Minh',
              isActive: true,
              mustChangePassword: false,
              locale: 'vi',
            },
            todayTasks: [],
            syncMetadata: {
              lastSuccessfulSyncAt: '2026-10-06T10:00:00.000Z',
              lastSyncError: null,
              isStale: false,
            },
          } as ExtensionState,
        }
      }
      return { ok: true, data: null }
    }

    const user = userEvent.setup()
    render(<App />)

    // Go to settings
    const settingsBtn = await screen.findByLabelText('Cài đặt')
    await user.click(settingsBtn)

    expect(await screen.findByRole('heading', { name: 'Cài đặt kết nối' })).toBeInTheDocument()

    // Find the toggle
    const toggle = screen.getByTestId('toggle-quick-pill')
    expect(toggle).not.toBeChecked()

    // Click toggle to enable
    await user.click(toggle)

    await waitFor(() => {
      expect(chrome.permissions.request).toHaveBeenCalledWith({
        origins: ['*://*/*'],
      })
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        quickPillEnabled: true,
      })
    })
  })
})
