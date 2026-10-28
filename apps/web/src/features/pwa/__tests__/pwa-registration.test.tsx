import React, { StrictMode } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({ options: null as any, register: vi.fn(), update: vi.fn(), reload: vi.fn() }))
vi.mock('virtual:pwa-register', () => ({ registerSW: (options: unknown) => { mock.options = options; mock.register(); return mock.update } }))
vi.mock('../pwa-browser', () => ({ reloadPage: mock.reload }))

let worker: EventTarget & { controller: object | null }
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  mock.options = null
  mock.update.mockResolvedValue(undefined)
  worker = Object.assign(new EventTarget(), { controller: { version: 'a' } })
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: worker })
})
afterEach(() => { cleanup(); vi.useRealTimers(); delete (navigator as any).serviceWorker })

describe('PWA registration', () => {
  it('retries a failed registration when connectivity returns', async () => {
    const module = await import('../use-pwa-registration')
    function Probe() { const state = module.usePwaRegistration(); return <span>{String(state.error)}</span> }
    render(<Probe />)
    act(() => mock.options.onRegisterError(new Error('offline')))
    expect(screen.getByText('true')).toBeInTheDocument()
    act(() => window.dispatchEvent(new Event('online')))
    expect(mock.register).toHaveBeenCalledTimes(2)
    act(() => mock.options.onRegisteredSW('/sw.js', { update: vi.fn() }))
    expect(screen.getByText('false')).toBeInTheDocument()
  })
  it('registers once in StrictMode and only reloads the consenting window once', async () => {
    const module = await import('../use-pwa-registration')
    function Probe() { const state = module.usePwaRegistration(); return <span>{state.state}</span> }
    render(<StrictMode><Probe /></StrictMode>)
    expect(mock.register).toHaveBeenCalledTimes(1)
    act(() => mock.options.onNeedRefresh())
    expect(screen.getByText('waiting')).toBeInTheDocument()
    await act(async () => { await module.activateUpdate() })
    expect(screen.getByText('activation-requested-locally')).toBeInTheDocument()
    worker.controller = { version: 'b' }
    act(() => { worker.dispatchEvent(new Event('controllerchange')); mock.options.onNeedReload() })
    expect(mock.reload).toHaveBeenCalledTimes(1)
    expect(screen.getByText('controller-changed-needs-reload')).toBeInTheDocument()
  })

  it('does not reload an externally updated window and blocks new writes', async () => {
    const module = await import('../use-pwa-registration')
    const safety = await import('../../../lib/write-safety')
    function Probe() { const state = module.usePwaRegistration(); return <span>{state.state}</span> }
    render(<Probe />)
    worker.controller = { version: 'b' }
    act(() => worker.dispatchEvent(new Event('controllerchange')))
    expect(screen.getByText('controller-changed-needs-reload')).toBeInTheDocument()
    expect(mock.reload).not.toHaveBeenCalled()
    await expect(safety.runGuardedWrite(async () => undefined)).rejects.toBeInstanceOf(safety.WriteBlockedForUpdateError)
    act(() => module.reloadUpdatedWindow())
    expect(mock.reload).toHaveBeenCalledTimes(1)
  })

  it('does not let an old failed attempt unlock a retry after watchdog timeout', async () => {
    vi.useFakeTimers()
    let rejectFirst!: (reason: Error) => void
    mock.update.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject })).mockResolvedValueOnce(undefined)
    const module = await import('../use-pwa-registration')
    const safety = await import('../../../lib/write-safety')
    function Probe() { const state = module.usePwaRegistration(); return <span>{state.state}</span> }
    render(<Probe />)
    act(() => mock.options.onNeedRefresh())
    let first!: Promise<boolean>
    act(() => { first = module.activateUpdate() })
    act(() => vi.advanceTimersByTime(30_000))
    expect(screen.getByText('waiting')).toBeInTheDocument()
    await act(async () => { await module.activateUpdate() })
    expect(safety.areWritesFrozen()).toBe(true)
    await act(async () => { rejectFirst(new Error('old failure')); await first })
    expect(screen.getByText('activation-requested-locally')).toBeInTheDocument()
    expect(safety.areWritesFrozen()).toBe(true)
  })

  it('ignores initial controller acquisition and waits for pending writes', async () => {
    worker.controller = null
    const module = await import('../use-pwa-registration')
    const safety = await import('../../../lib/write-safety')
    function Probe() { const state = module.usePwaRegistration(); return <span>{state.state}</span> }
    render(<Probe />)
    worker.controller = { version: 'a' }
    act(() => worker.dispatchEvent(new Event('controllerchange')))
    expect(screen.getByText('idle')).toBeInTheDocument()
    let finish!: () => void
    const write = safety.runGuardedWrite(() => new Promise<void>(resolve => { finish = resolve }))
    act(() => mock.options.onNeedRefresh())
    expect(await module.activateUpdate()).toBe(false)
    expect(mock.update).not.toHaveBeenCalled()
    finish()
    await write
  })

  it('recovers from failed activation without unlocking after a controller change', async () => {
    let reject!: (reason: Error) => void
    mock.update.mockImplementation(() => new Promise((_resolve, fail) => { reject = fail }))
    const module = await import('../use-pwa-registration')
    const safety = await import('../../../lib/write-safety')
    function Probe() { const state = module.usePwaRegistration(); return <span>{state.state}:{String(state.error)}</span> }
    render(<Probe />)
    act(() => mock.options.onNeedRefresh())
    let update!: Promise<boolean>
    act(() => { update = module.activateUpdate() })
    worker.controller = { version: 'b' }
    act(() => worker.dispatchEvent(new Event('controllerchange')))
    await act(async () => { reject(new Error('late')); await update })
    expect(screen.getByText('controller-changed-needs-reload:false')).toBeInTheDocument()
    expect(safety.areWritesFrozen()).toBe(true)
    expect(mock.reload).toHaveBeenCalledTimes(1)
  })

  it('allows another confirmed reload if navigation was interrupted', async () => {
    vi.useFakeTimers()
    const module = await import('../use-pwa-registration')
    function Probe() { const state = module.usePwaRegistration(); return <span>{state.state}</span> }
    render(<Probe />)
    worker.controller = { version: 'b' }
    act(() => worker.dispatchEvent(new Event('controllerchange')))
    act(() => module.reloadUpdatedWindow())
    expect(module.isUpdateReloading()).toBe(true)
    expect(mock.reload).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(2_000))
    expect(module.isUpdateReloading()).toBe(false)
    act(() => module.reloadUpdatedWindow())
    expect(mock.reload).toHaveBeenCalledTimes(2)
  })
})
