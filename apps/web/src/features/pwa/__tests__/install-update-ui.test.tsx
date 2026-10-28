import React, { useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { InstallPrompt } from '../install-prompt'
import { PwaSettingsCard } from '../pwa-settings-card'
import { useVersionNavigationGuard } from '../use-version-navigation-guard'
import { useSafeNavigate } from '../use-safe-navigate'

const mock = vi.hoisted(() => ({ state: 'idle' }))
vi.mock('../../auth/auth-provider', () => ({ useAuth: () => ({ user: { id: 'a' }, profile: { id: 'a', isActive: true }, isAuthLoading: false, isProfileLoading: false }) }))
vi.mock('../pwa-update-context', () => ({ usePwaUpdate: () => ({ state: mock.state, error: false }) }))

describe('install and update UI', () => {
  it('shows Safari instructions without presenting a fake install button', () => {
    const agent = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone Safari')
    render(<PwaSettingsCard />)
    expect(screen.getByText(/Chia sẻ → Thêm vào Màn hình chính/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cài đặt' })).not.toBeInTheDocument()
    agent.mockRestore()
  })
  it('offers installation only with a real event and hides it after dismissal or installation', async () => {
    render(<><InstallPrompt /><PwaSettingsCard /></>)
    expect(screen.queryByRole('button', { name: 'Cài đặt' })).not.toBeInTheDocument()
    const event = new Event('beforeinstallprompt', { cancelable: true }) as any
    event.prompt = vi.fn().mockResolvedValue(undefined)
    event.userChoice = Promise.resolve({ outcome: 'dismissed' })
    act(() => { window.dispatchEvent(event) })
    expect(event.defaultPrevented).toBe(true)
    expect(screen.getAllByRole('button', { name: 'Cài đặt' })).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('button', { name: 'Cài đặt' })[0])
    await waitFor(() => expect(event.prompt).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('button', { name: 'Cài đặt' })).not.toBeInTheDocument()
    act(() => { window.dispatchEvent(new Event('appinstalled')) })
    expect(screen.getByText('TabDo đã được cài đặt.')).toBeInTheDocument()
  })

  it('keeps the rendered route and draft when another window updates', () => {
    function Draft() { const [value, setValue] = useState(''); return <input aria-label="draft" value={value} onChange={event => setValue(event.target.value)} /> }
    function View() { const location = useVersionNavigationGuard(); const actual = useLocation(); const navigate = useSafeNavigate(); return <><span data-testid="url">{actual.pathname}</span><Link to="/other">navigate</Link><button onClick={() => navigate('/other')}>button navigation</button><Routes location={location}><Route path="/" element={<Draft />} /><Route path="/other" element={<div>other</div>} /></Routes></> }
    mock.state = 'idle'
    const view = render(<MemoryRouter><View /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('draft'), { target: { value: 'draft' } })
    mock.state = 'controller-changed-needs-reload'
    view.rerender(<MemoryRouter><View /></MemoryRouter>)
    fireEvent.click(screen.getByText('navigate'))
    fireEvent.click(screen.getByText('button navigation'))
    expect(screen.getByLabelText('draft')).toHaveValue('draft')
    expect(screen.queryByText('other')).not.toBeInTheDocument()
    expect(screen.getByTestId('url')).toHaveTextContent('/')
  })
})
