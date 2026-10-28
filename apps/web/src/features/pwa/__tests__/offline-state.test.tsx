import React, { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthenticatedRoute } from '../../auth/authenticated-route'

let auth: any
vi.mock('../../auth/auth-provider', () => ({ useAuth: () => auth }))

function Draft() {
  const [value, setValue] = useState('')
  return <input aria-label="draft" value={value} onChange={event => setValue(event.target.value)} />
}

afterEach(() => vi.restoreAllMocks())

describe('offline private routes', () => {
  it('does not render private content for a cold unverified session', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    auth = { session: null, profile: null, isAuthLoading: true, retrySession: vi.fn() }
    render(<MemoryRouter><AuthenticatedRoute><Draft /></AuthenticatedRoute></MemoryRouter>)
    expect(screen.getByText(/không thể xác minh phiên khi ngoại tuyến/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('draft')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Thử lại'))
    expect(auth.retrySession).toHaveBeenCalled()
  })

  it('retains a verified user draft through offline and online transitions', () => {
    let online = true
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
    auth = { session: { user: { id: 'a' } }, profile: { id: 'a', isActive: true }, isAuthLoading: false, isProfileLoading: false }
    render(<MemoryRouter><AuthenticatedRoute><Draft /></AuthenticatedRoute></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('draft'), { target: { value: 'draft A' } })
    online = false
    fireEvent(window, new Event('offline'))
    expect(screen.getByRole('status')).toHaveTextContent(/dữ liệu có thể đã cũ/i)
    expect(screen.getByLabelText('draft')).toHaveValue('draft A')
    online = true
    fireEvent(window, new Event('online'))
    expect(screen.getByLabelText('draft')).toHaveValue('draft A')
  })
})
