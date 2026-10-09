import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Extension Context Menu On-Demand Activation', () => {
  let contextMenuClickHandler: (
    info: { menuItemId: string; selectionText?: string; frameId?: number; pageUrl?: string },
    tab?: { id?: number; url?: string }
  ) => Promise<void>

  let sendMessageMock: any
  let executeScriptMock: any

  beforeEach(() => {
    sendMessageMock = vi.fn()
    executeScriptMock = vi.fn().mockResolvedValue([])

    // Simulated handler logic matching apps/extension/entrypoints/background.ts
    contextMenuClickHandler = async (info, tab) => {
      if (info.menuItemId === 'tabdo:create-task-selection' && tab?.id && info.selectionText) {
        const tabId = tab.id
        const frameId = info.frameId
        const pageUrl = info.pageUrl || tab.url || ''

        // Guard against restricted pages
        if (
          !pageUrl ||
          pageUrl.startsWith('chrome://') ||
          pageUrl.startsWith('edge://') ||
          pageUrl.startsWith('about:') ||
          pageUrl.startsWith('chrome-extension://') ||
          pageUrl.startsWith('devtools://') ||
          pageUrl.startsWith('view-source:')
        ) {
          return
        }

        const message = {
          type: 'tabdo:open-create-dialog',
          payload: {
            text: info.selectionText,
            url: pageUrl,
          },
        }

        const targetOptions = frameId !== undefined ? { frameId } : undefined

        try {
          await sendMessageMock(tabId, message, targetOptions)
        } catch {
          // On-demand injection into active tab
          try {
            await executeScriptMock({
              target: { tabId, allFrames: false },
              files: ['content-scripts/content.js'],
            })
            await sendMessageMock(tabId, message, targetOptions)
          } catch {
            // Ignore injection failure
          }
        }
      }
    }
  })

  it('sends open-dialog message directly if content script is already listening', async () => {
    sendMessageMock.mockResolvedValueOnce({ ok: true })

    await contextMenuClickHandler(
      {
        menuItemId: 'tabdo:create-task-selection',
        selectionText: 'Buy milk and eggs',
        pageUrl: 'https://example.com/grocery',
      },
      { id: 101, url: 'https://example.com/grocery' }
    )

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(sendMessageMock).toHaveBeenCalledWith(
      101,
      {
        type: 'tabdo:open-create-dialog',
        payload: {
          text: 'Buy milk and eggs',
          url: 'https://example.com/grocery',
        },
      },
      undefined
    )
    expect(executeScriptMock).not.toHaveBeenCalled()
  })

  it('injects content script on demand if tab is not yet listening, then sends message', async () => {
    sendMessageMock
      .mockRejectedValueOnce(new Error('Could not establish connection. Receiving end does not exist.'))
      .mockResolvedValueOnce({ ok: true })

    await contextMenuClickHandler(
      {
        menuItemId: 'tabdo:create-task-selection',
        selectionText: 'Meeting notes from call',
        pageUrl: 'https://news.ycombinator.com',
      },
      { id: 202, url: 'https://news.ycombinator.com' }
    )

    expect(executeScriptMock).toHaveBeenCalledWith({
      target: { tabId: 202, allFrames: false },
      files: ['content-scripts/content.js'],
    })
    expect(sendMessageMock).toHaveBeenCalledTimes(2)
    expect(sendMessageMock).toHaveBeenLastCalledWith(
      202,
      {
        type: 'tabdo:open-create-dialog',
        payload: {
          text: 'Meeting notes from call',
          url: 'https://news.ycombinator.com',
        },
      },
      undefined
    )
  })

  it('gracefully skips execution on restricted chrome:// or edge:// browser pages', async () => {
    await contextMenuClickHandler(
      {
        menuItemId: 'tabdo:create-task-selection',
        selectionText: 'Settings text',
        pageUrl: 'chrome://settings',
      },
      { id: 303, url: 'chrome://settings' }
    )

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(executeScriptMock).not.toHaveBeenCalled()
  })

  it('gracefully skips execution on about:blank or devtools pages', async () => {
    await contextMenuClickHandler(
      {
        menuItemId: 'tabdo:create-task-selection',
        selectionText: 'Inspector text',
        pageUrl: 'devtools://devtools/bundled/inspector.html',
      },
      { id: 404, url: 'devtools://devtools/bundled/inspector.html' }
    )

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(executeScriptMock).not.toHaveBeenCalled()
  })
})
