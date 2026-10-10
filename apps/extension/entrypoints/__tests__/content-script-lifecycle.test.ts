import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import contentScript from '../content.js'

describe('Content Script Lifecycle & Activation Cleanup', () => {
  let runtimeAddListenerMock: any
  let runtimeRemoveListenerMock: any
  let storageAddListenerMock: any
  let storageRemoveListenerMock: any
  let sendMessageMock: any
  let documentAddSpy: any
  let documentRemoveSpy: any

  beforeEach(() => {
    document.body.innerHTML = ''
    document.documentElement.innerHTML = '<head></head><body></body>'

    runtimeAddListenerMock = vi.fn()
    runtimeRemoveListenerMock = vi.fn()
    storageAddListenerMock = vi.fn()
    storageRemoveListenerMock = vi.fn()
    sendMessageMock = vi.fn()

    documentAddSpy = vi.spyOn(document, 'addEventListener')
    documentRemoveSpy = vi.spyOn(document, 'removeEventListener')

    ;(globalThis as any).chrome = {
      runtime: {
        id: 'mock-extension-id',
        onMessage: {
          addListener: runtimeAddListenerMock,
          removeListener: runtimeRemoveListenerMock,
        },
        sendMessage: sendMessageMock,
      },
      storage: {
        local: {
          get: vi.fn(),
          set: vi.fn(),
        },
        onChanged: {
          addListener: storageAddListenerMock,
          removeListener: storageRemoveListenerMock,
        },
      },
    }
  })

  afterEach(() => {
    if (typeof (window as any).__tabdo_companion_cleanup === 'function') {
      try {
        ;(window as any).__tabdo_companion_cleanup()
      } catch {
        // ignore
      }
    }
    const host = document.getElementById('tabdo-companion-root')
    if (host) host.remove()
    vi.restoreAllMocks()
  })

  it('1. initial injection: attaches shadow root, registers cleanup, and does NOT activate on selection alone when disabled', () => {
    contentScript.main({} as any)

    // Host attached
    const hosts = document.querySelectorAll('#tabdo-companion-root')
    expect(hosts.length).toBe(1)
    expect((window as any).__tabdo_companion_cleanup).toBeTypeOf('function')

    // Document, runtime, and storage listeners registered
    expect(runtimeAddListenerMock).toHaveBeenCalledTimes(1)
    expect(storageAddListenerMock).toHaveBeenCalledTimes(1)
    expect(documentAddSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(documentAddSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
    expect(documentAddSpy).toHaveBeenCalledWith('selectionchange', expect.any(Function))
    expect(documentAddSpy).toHaveBeenCalledWith('mousedown', expect.any(Function))

    // Pill element exists in shadow root but is hidden by default
    const shadow = hosts[0]?.shadowRoot
    const pill = shadow?.querySelector('.tabdo-pill') as HTMLElement
    expect(pill).not.toBeNull()
    expect(pill.style.display).toBe('none')

    // Verify selecting text does NOT show floating pill or dialog when disabled
    const mouseUpEvent = new MouseEvent('mouseup', { bubbles: true })
    document.dispatchEvent(mouseUpEvent)
    const selectionEvent = new Event('selectionchange')
    document.dispatchEvent(selectionEvent)

    expect(pill.style.display).toBe('none')
    const overlay = shadow?.querySelector('.tabdo-overlay') as HTMLElement
    expect(overlay.style.display).toBe('none')
  })

  it('2. repeated injection: cleans up stale listeners and prevents duplicate UI roots', () => {
    // First injection
    contentScript.main({} as any)
    expect(document.querySelectorAll('#tabdo-companion-root').length).toBe(1)

    // Second injection (simulating repeated activation or extension reload)
    contentScript.main({} as any)

    // Verify previous listeners were properly released during cleanup
    expect(runtimeRemoveListenerMock).toHaveBeenCalledTimes(1)
    expect(storageRemoveListenerMock).toHaveBeenCalledTimes(1)
    expect(documentRemoveSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(documentRemoveSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
    expect(documentRemoveSpy).toHaveBeenCalledWith('selectionchange', expect.any(Function))
    expect(documentRemoveSpy).toHaveBeenCalledWith('mousedown', expect.any(Function))

    // Exactly one UI root exists on page
    expect(document.querySelectorAll('#tabdo-companion-root').length).toBe(1)
  })

  it('3. context-menu message triggers task creation dialog with acknowledgment and source url', () => {
    contentScript.main({} as any)

    const host = document.getElementById('tabdo-companion-root')!
    const shadow = host.shadowRoot!
    const overlay = shadow.querySelector('.tabdo-overlay') as HTMLElement
    const textarea = shadow.querySelector('#tabdo-task-title') as HTMLTextAreaElement

    // Initial state: hidden
    expect(overlay.style.display).toBe('none')

    // Simulate background script sending tabdo:open-create-dialog message
    const messageListener = runtimeAddListenerMock.mock.calls[0][0]
    expect(messageListener).toBeTypeOf('function')

    const sendResponse = vi.fn()
    const isAsync = messageListener(
      {
        type: 'tabdo:open-create-dialog',
        payload: {
          text: 'Task from article snippet',
          url: 'https://news.ycombinator.com/item?id=123',
        },
      },
      {},
      sendResponse
    )

    expect(isAsync).toBe(true)
    expect(sendResponse).toHaveBeenCalledWith({ ok: true })

    // Dialog is opened with populated text
    expect(overlay.style.display).toBe('flex')
    expect(textarea.value).toBe('Task from article snippet')
  })

  it('4. storage change disables previously injected Floating Pill UI immediately', () => {
    contentScript.main({} as any)

    const host = document.getElementById('tabdo-companion-root')!
    const shadow = host.shadowRoot!
    const pill = shadow.querySelector('.tabdo-pill') as HTMLElement

    // Manually simulate storage enabled
    const storageListener = storageAddListenerMock.mock.calls[0][0]
    expect(storageListener).toBeTypeOf('function')

    // Simulate pill being active
    pill.style.display = 'inline-flex'
    expect(pill.style.display).toBe('inline-flex')

    // User disables feature in settings -> storage event fires
    storageListener(
      {
        quickPillEnabled: {
          oldValue: true,
          newValue: false,
        },
      },
      'local'
    )

    // Pill must be hidden immediately without page refresh
    expect(pill.style.display).toBe('none')
  })

  it('5. cleanup handler releases all resources and removes DOM root', () => {
    contentScript.main({} as any)
    expect(document.getElementById('tabdo-companion-root')).not.toBeNull()

    // Invoke cleanup explicitly
    const cleanup = (window as any).__tabdo_companion_cleanup
    expect(cleanup).toBeTypeOf('function')
    cleanup()

    // All listeners released
    expect(documentRemoveSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(documentRemoveSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
    expect(documentRemoveSpy).toHaveBeenCalledWith('selectionchange', expect.any(Function))
    expect(documentRemoveSpy).toHaveBeenCalledWith('mousedown', expect.any(Function))
    expect(runtimeRemoveListenerMock).toHaveBeenCalledTimes(1)
    expect(storageRemoveListenerMock).toHaveBeenCalledTimes(1)

    // Host element removed
    expect(document.getElementById('tabdo-companion-root')).toBeNull()
    expect((window as any).__tabdo_companion_cleanup).toBeUndefined()
  })
})
