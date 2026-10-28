import React from 'react'
import { createPortal } from 'react-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '../auth-provider'
import { supabase } from '../../../lib/supabase'
import { SessionVerificationBoundary, usePrivatePortalHost } from '../session-verification-boundary'
import { ConfirmProvider, useConfirm } from '../../../components/ui/confirm-dialog'
import { runGuardedWrite, SessionVerificationError } from '../../../lib/write-safety'

vi.mock('../../../lib/supabase', () => ({ supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(), signOut: vi.fn() }, from: vi.fn() } }))

let capturedRefresh: (() => Promise<void>) | undefined
function Probe() {
  const { user, profile, authError, signOut, refreshProfile } = useAuth()
  if (user?.id === 'a' && profile?.id === 'a') capturedRefresh = refreshProfile
  return <><span>{user?.id ?? 'none'}:{profile?.id ?? 'none'}</span><span>{authError}</span><button onClick={() => signOut()}>sign out</button></>
}
function PortalAndConfirm() {
  const host = usePrivatePortalHost()
  const confirm = useConfirm()
  return <>
    <button onClick={() => void confirm({ title: 'Confirm private action', message: 'private' })}>open confirmation</button>
    {host && createPortal(<input aria-label="portal draft" />, host)}
  </>
}

describe('auth identity races', () => {
  beforeEach(() => vi.clearAllMocks())
  it('hides but preserves a draft while a resumed session cannot be verified', async () => {
    const session = { user: { id: 'a' } }
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session }, error: null } as never)
      .mockResolvedValueOnce({ data: { session: null }, error: { message: 'unavailable' } } as never)
      .mockResolvedValueOnce({ data: { session }, error: null } as never)
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } } as never)
    vi.mocked(supabase.from).mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'a', role: 'user' }, error: null }) }) }) } as never)
    render(<AuthProvider><Probe /><SessionVerificationBoundary><ConfirmProvider><input aria-label="draft" /><PortalAndConfirm /></ConfirmProvider></SessionVerificationBoundary></AuthProvider>)
    await waitFor(() => expect(screen.getByText('a:a')).toBeInTheDocument())
    const draft = screen.getByLabelText('draft')
    fireEvent.change(draft, { target: { value: 'private draft' } })
    const portalDraft = screen.getByLabelText('portal draft')
    fireEvent.change(portalDraft, { target: { value: 'portal secret' } })
    fireEvent.click(screen.getByText('open confirmation'))
    expect(screen.getByRole('dialog')).toBeVisible()
    await act(async () => { window.dispatchEvent(new Event('pageshow')) })
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể xác minh phiên')
    expect(draft).not.toBeVisible()
    expect(screen.queryByRole('textbox', { name: 'draft' })).toBeNull()
    expect(portalDraft).not.toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    const write = vi.fn(async () => undefined)
    await expect(runGuardedWrite(write)).rejects.toBeInstanceOf(SessionVerificationError)
    expect(write).not.toHaveBeenCalled()
    await act(async () => { screen.getByText('Thử lại').click() })
    expect(screen.getByLabelText('draft')).toHaveValue('private draft')
    expect(screen.getByLabelText('draft')).toBe(draft)
    expect(screen.getByLabelText('portal draft')).toBe(portalDraft)
    expect(portalDraft).toHaveValue('portal secret')
    expect(screen.getByRole('dialog')).toBeVisible()
    await runGuardedWrite(write)
    expect(write).toHaveBeenCalledTimes(1)
  })
  it('keeps a verified profile when an explicit refresh fails offline', async () => {
    let online = true
    const onlineSpy = vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
    capturedRefresh = undefined
    const session = { user: { id: 'a' } }
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session }, error: null } as never)
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } } as never)
    const read = vi.fn().mockResolvedValueOnce({ data: { id: 'a', role: 'user' }, error: null }).mockImplementationOnce(async () => { online = false; return { data: null, error: { message: 'network error' } } })
    vi.mocked(supabase.from).mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: read }) }) } as never)
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(capturedRefresh).toBeDefined())
    await act(async () => { await capturedRefresh!() })
    expect(screen.getByText('a:a')).toBeInTheDocument()
    onlineSpy.mockRestore()
  })
  it('discards a late profile response from the previous user', async () => {
    let callback!: (event: string, session: unknown) => void
    let resolveA!: (value: unknown) => void
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as never)
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((handler: any) => {
      callback = handler
      return { data: { subscription: { unsubscribe: vi.fn() } } } as never
    })
    vi.mocked(supabase.from).mockImplementation(() => ({
      select: () => ({ eq: (_field: string, id: string) => ({ maybeSingle: () => id === 'a'
        ? new Promise(resolve => { resolveA = resolve })
        : Promise.resolve({ data: { id: 'b', role: 'user' }, error: null }) }) }),
    }) as never)
    render(<AuthProvider><Probe /></AuthProvider>)
    await act(async () => { callback('SIGNED_IN', { user: { id: 'a' } }) })
    await act(async () => { callback('SIGNED_IN', { user: { id: 'b' } }) })
    await waitFor(() => expect(screen.getByText('b:b')).toBeInTheDocument())
    await act(async () => { resolveA({ data: { id: 'a', role: 'admin' }, error: null }) })
    expect(screen.getByText('b:b')).toBeInTheDocument()
  })

  it('keeps private access blocked after failed logout despite token refresh', async () => {
    let callback!: (event: string, session: unknown) => void
    const session = { user: { id: 'a' } }
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session }, error: null } as never)
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((handler: any) => {
      callback = handler
      return { data: { subscription: { unsubscribe: vi.fn() } } } as never
    })
    vi.mocked(supabase.from).mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'a', role: 'user' }, error: null }) }) }) } as never)
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: { message: 'network failure' } } as never)
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByText('a:a')).toBeInTheDocument())
    await act(async () => { screen.getByText('sign out').click() })
    expect(screen.getByText(/không thể xác nhận đăng xuất/i)).toBeInTheDocument()
    await act(async () => { callback('TOKEN_REFRESHED', session) })
    expect(screen.getByText(/không thể xác nhận đăng xuất/i)).toBeInTheDocument()
  })

  it('ignores a refresh callback captured before an identity switch', async () => {
    let callback!: (event: string, session: unknown) => void
    let resolveB!: (value: unknown) => void
    capturedRefresh = undefined
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as never)
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((handler: any) => {
      callback = handler
      return { data: { subscription: { unsubscribe: vi.fn() } } } as never
    })
    vi.mocked(supabase.from).mockImplementation(() => ({ select: () => ({ eq: (_: string, id: string) => ({ maybeSingle: () => id === 'a'
      ? Promise.resolve({ data: { id: 'a', role: 'user' }, error: null })
      : new Promise(resolve => { resolveB = resolve }) }) }) }) as never)
    render(<AuthProvider><Probe /></AuthProvider>)
    await act(async () => { callback('SIGNED_IN', { user: { id: 'a' } }) })
    await waitFor(() => expect(capturedRefresh).toBeDefined())
    const staleRefresh = capturedRefresh!
    await act(async () => { callback('SIGNED_IN', { user: { id: 'b' } }) })
    await act(async () => { await staleRefresh() })
    await act(async () => { resolveB({ data: { id: 'b', role: 'user' }, error: null }) })
    expect(screen.getByText('b:b')).toBeInTheDocument()
  })

  it.each(['b', 'a'])('does not let an old logout affect a new %s session', async nextId => {
    let callback!: (event: string, session: unknown) => void
    let finishLogout!: (value: unknown) => void
    const first = { user: { id: 'a' }, access_token: 'old' }
    const next = { user: { id: nextId }, access_token: 'new' }
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: first }, error: null } as never)
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((handler: any) => {
      callback = handler
      return { data: { subscription: { unsubscribe: vi.fn() } } } as never
    })
    vi.mocked(supabase.from).mockImplementation(() => ({ select: () => ({ eq: (_: string, id: string) => ({ maybeSingle: async () => ({ data: { id, role: 'user' }, error: null }) }) }) }) as never)
    vi.mocked(supabase.auth.signOut).mockImplementation(() => new Promise(resolve => { finishLogout = resolve }) as never)
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByText('a:a')).toBeInTheDocument())
    act(() => { screen.getByText('sign out').click() })
    if (nextId === 'a') await act(async () => { callback('SIGNED_OUT', null) })
    await act(async () => { callback('SIGNED_IN', next) })
    await act(async () => { finishLogout({ error: { message: 'old failure' } }) })
    await waitFor(() => expect(screen.getByText(`${nextId}:${nextId}`)).toBeInTheDocument())
    expect(screen.queryByText(/không thể xác nhận đăng xuất/i)).not.toBeInTheDocument()
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1)
  })

  it('does not launch concurrent logout operations', async () => {
    let finish!: (value: unknown) => void
    const session = { user: { id: 'a' }, access_token: 'old' }
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session }, error: null } as never)
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } } as never)
    vi.mocked(supabase.from).mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'a', role: 'user' }, error: null }) }) }) } as never)
    vi.mocked(supabase.auth.signOut).mockImplementation(() => new Promise(resolve => { finish = resolve }) as never)
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByText('a:a')).toBeInTheDocument())
    act(() => { screen.getByText('sign out').click(); screen.getByText('sign out').click() })
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1)
    await act(async () => { finish({ error: null }) })
    expect(screen.getByText(/không thể xác nhận đăng xuất/i)).toBeInTheDocument()
  })
})
