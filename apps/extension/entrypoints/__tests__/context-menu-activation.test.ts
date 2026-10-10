import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  handleContextMenuClick,
  isRestrictedUrl,
  CONTEXT_MENU_ITEM_ID,
} from '../../lib/context-menu.js'

describe('Extension Context Menu On-Demand Activation (Production Handler)', () => {
  let sendMessageMock: any
  let executeScriptMock: any

  beforeEach(() => {
    sendMessageMock = vi.fn()
    executeScriptMock = vi.fn().mockResolvedValue([])

    // Set up global chrome mock
    ;(globalThis as any).chrome = {
      tabs: {
        sendMessage: sendMessageMock,
      },
      scripting: {
        executeScript: executeScriptMock,
      },
    }
  })

  describe('isRestrictedUrl', () => {
    it('correctly identifies restricted and permitted URLs', () => {
      expect(isRestrictedUrl('chrome://extensions')).toBe(true)
      expect(isRestrictedUrl('edge://settings')).toBe(true)
      expect(isRestrictedUrl('about:blank')).toBe(true)
      expect(isRestrictedUrl('chrome-extension://abcdef/popup.html')).toBe(true)
      expect(isRestrictedUrl('devtools://devtools/bundled/inspector.html')).toBe(true)
      expect(isRestrictedUrl('view-source:https://example.com')).toBe(true)
      expect(isRestrictedUrl('')).toBe(true)
      expect(isRestrictedUrl(undefined)).toBe(true)

      expect(isRestrictedUrl('https://github.com')).toBe(false)
      expect(isRestrictedUrl('http://localhost:5173')).toBe(false)
      expect(isRestrictedUrl('https://sub.domain.org/path?q=1')).toBe(false)
    })
  })

  describe('Normal page activation', () => {
    it('sends message directly to top frame (frameId: 0) when content script is already listening', async () => {
      sendMessageMock.mockResolvedValueOnce({ ok: true })

      const success = await handleContextMenuClick(
        {
          menuItemId: CONTEXT_MENU_ITEM_ID,
          selectionText: 'Buy milk tomorrow',
          pageUrl: 'https://example.com/notes',
        },
        { id: 42, url: 'https://example.com/notes' }
      )

      expect(success).toBe(true)
      expect(executeScriptMock).not.toHaveBeenCalled()
      expect(sendMessageMock).toHaveBeenCalledTimes(1)
      expect(sendMessageMock).toHaveBeenCalledWith(
        42,
        {
          type: 'tabdo:open-create-dialog',
          payload: { text: 'Buy milk tomorrow', url: 'https://example.com/notes' },
        },
        { frameId: 0 }
      )
    })

    it('injects content script into top frame on-demand when not initially loaded, then delivers message with ack', async () => {
      // First attempt fails (not injected yet)
      sendMessageMock.mockRejectedValueOnce(new Error('Could not establish connection. Receiving end does not exist.'))
      // After injection, succeeds
      sendMessageMock.mockResolvedValueOnce({ ok: true })

      const success = await handleContextMenuClick(
        {
          menuItemId: CONTEXT_MENU_ITEM_ID,
          selectionText: 'Review design doc',
          pageUrl: 'https://tabdo.app/dashboard',
        },
        { id: 100, url: 'https://tabdo.app/dashboard' }
      )

      expect(success).toBe(true)
      expect(executeScriptMock).toHaveBeenCalledTimes(1)
      expect(executeScriptMock).toHaveBeenCalledWith({
        target: { tabId: 100, frameIds: [0] },
        files: ['content-scripts/content.js'],
      })
      expect(sendMessageMock).toHaveBeenCalledTimes(2)
      expect(sendMessageMock).toHaveBeenLastCalledWith(
        100,
        {
          type: 'tabdo:open-create-dialog',
          payload: { text: 'Review design doc', url: 'https://tabdo.app/dashboard' },
        },
        { frameId: 0 }
      )
    })
  })

  describe('Iframe and frame targeting', () => {
    it('handles selection from same-origin or cross-origin iframe: displays dialog in top frame (frameId: 0) while preserving source frameUrl', async () => {
      sendMessageMock.mockResolvedValueOnce({ ok: true })

      const success = await handleContextMenuClick(
        {
          menuItemId: CONTEXT_MENU_ITEM_ID,
          selectionText: 'Selected text from embedded widget',
          pageUrl: 'https://main-app.com/workspace',
          frameUrl: 'https://embedded-partner.com/widget?id=99',
          frameId: 12345, // Selection originated in iframe 12345
        },
        { id: 77, url: 'https://main-app.com/workspace' }
      )

      expect(success).toBe(true)
      // Must NOT send to iframe frameId 12345; dialog must appear in top frame (frameId: 0)
      expect(sendMessageMock).toHaveBeenCalledWith(
        77,
        {
          type: 'tabdo:open-create-dialog',
          payload: {
            text: 'Selected text from embedded widget',
            url: 'https://embedded-partner.com/widget?id=99', // Frame source preserved
          },
        },
        { frameId: 0 }
      )
    })

    it('injects into top frame when iframe selection triggers on-demand injection', async () => {
      sendMessageMock.mockRejectedValueOnce(new Error('Receiving end does not exist'))
      sendMessageMock.mockResolvedValueOnce({ ok: true })

      const success = await handleContextMenuClick(
        {
          menuItemId: CONTEXT_MENU_ITEM_ID,
          selectionText: 'Nested iframe note',
          pageUrl: 'https://main-app.com/article',
          frameUrl: 'https://cdn.comments.com/iframe',
          frameId: 555,
        },
        { id: 88, url: 'https://main-app.com/article' }
      )

      expect(success).toBe(true)
      expect(executeScriptMock).toHaveBeenCalledWith({
        target: { tabId: 88, frameIds: [0] },
        files: ['content-scripts/content.js'],
      })
    })
  })

  describe('Repeated activation and lifecycle', () => {
    it('handles repeated activation gracefully: first call injects, second call communicates immediately', async () => {
      // First activation: requires injection
      sendMessageMock.mockRejectedValueOnce(new Error('No listener'))
      sendMessageMock.mockResolvedValueOnce({ ok: true })

      const firstResult = await handleContextMenuClick(
        {
          menuItemId: CONTEXT_MENU_ITEM_ID,
          selectionText: 'First task',
          pageUrl: 'https://example.com/1',
        },
        { id: 10, url: 'https://example.com/1' }
      )
      expect(firstResult).toBe(true)
      expect(executeScriptMock).toHaveBeenCalledTimes(1)

      // Second activation: content script is already listening
      sendMessageMock.mockResolvedValueOnce({ ok: true })

      const secondResult = await handleContextMenuClick(
        {
          menuItemId: CONTEXT_MENU_ITEM_ID,
          selectionText: 'Second task',
          pageUrl: 'https://example.com/1',
        },
        { id: 10, url: 'https://example.com/1' }
      )
      expect(secondResult).toBe(true)
      expect(executeScriptMock).toHaveBeenCalledTimes(1) // Not injected again
      expect(sendMessageMock).toHaveBeenCalledTimes(3)
    })
  })

  describe('Restricted pages and errors', () => {
    it('ignores internal and restricted pages without attempting injection or messaging', async () => {
      const restrictedUrls = [
        'chrome://settings',
        'edge://extensions',
        'about:blank',
        'chrome-extension://abcdef/options.html',
        'devtools://devtools/bundled/devtools_app.html',
        'view-source:https://example.com',
      ]

      for (const url of restrictedUrls) {
        const result = await handleContextMenuClick(
          {
            menuItemId: CONTEXT_MENU_ITEM_ID,
            selectionText: 'Some internal text',
            pageUrl: url,
          },
          { id: 1, url }
        )
        expect(result).toBe(false)
        expect(executeScriptMock).not.toHaveBeenCalled()
        expect(sendMessageMock).not.toHaveBeenCalled()
      }
    })

    it('returns false when script injection fails with a runtime error', async () => {
      sendMessageMock.mockRejectedValue(new Error('Receiving end does not exist'))
      executeScriptMock.mockRejectedValueOnce(new Error('Cannot access contents of the page'))

      const success = await handleContextMenuClick(
        {
          menuItemId: CONTEXT_MENU_ITEM_ID,
          selectionText: 'Text on protected page',
          pageUrl: 'https://protected.corporate.internal',
        },
        { id: 50, url: 'https://protected.corporate.internal' }
      )

      expect(success).toBe(false)
    })

    it('returns false when content script fails to acknowledge message after injection', async () => {
      sendMessageMock.mockRejectedValue(new Error('Listener never registered'))

      const success = await handleContextMenuClick(
        {
          menuItemId: CONTEXT_MENU_ITEM_ID,
          selectionText: 'Text on uncooperative page',
          pageUrl: 'https://example.com/stuck',
        },
        { id: 60, url: 'https://example.com/stuck' }
      )

      expect(success).toBe(false)
      expect(executeScriptMock).toHaveBeenCalledTimes(1)
    })

    it('returns false for unrelated context menu items or missing selection', async () => {
      const wrongItem = await handleContextMenuClick(
        {
          menuItemId: 'other-extension-item',
          selectionText: 'Hello',
        },
        { id: 1 }
      )
      expect(wrongItem).toBe(false)

      const noSelection = await handleContextMenuClick(
        {
          menuItemId: CONTEXT_MENU_ITEM_ID,
          selectionText: '',
        },
        { id: 1 }
      )
      expect(noSelection).toBe(false)

      const noTab = await handleContextMenuClick({
        menuItemId: CONTEXT_MENU_ITEM_ID,
        selectionText: 'Valid text',
      })
      expect(noTab).toBe(false)
    })
  })
})
