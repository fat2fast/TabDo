export interface ContextMenuClickInfo {
  menuItemId: string | number
  selectionText?: string
  pageUrl?: string
  frameUrl?: string
  frameId?: number
}

export interface ContextMenuTargetTab {
  id?: number
  url?: string
}

export const CONTEXT_MENU_ITEM_ID = 'tabdo:create-task-selection'

export const RESTRICTED_URL_PREFIXES = [
  'chrome://',
  'edge://',
  'about:',
  'chrome-extension://',
  'devtools://',
  'view-source:',
] as const

export function isRestrictedUrl(url?: string): boolean {
  if (!url) return true
  return RESTRICTED_URL_PREFIXES.some((prefix) => url.startsWith(prefix))
}

/**
 * Polls for content script message acknowledgment with retry backoff.
 */
export async function sendOpenDialogWithAck(
  tabId: number,
  payload: { text: string; url: string },
  options: { frameId: number } = { frameId: 0 },
  maxAttempts = 5,
  retryDelayMs = 30
): Promise<boolean> {
  const message = {
    type: 'tabdo:open-create-dialog',
    payload,
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message, options)
      if (response?.ok) {
        return true
      }
    } catch {
      // Content script may not be registered yet or busy mounting
    }
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
    }
  }
  return false
}

/**
 * Production handler for context menu clicks.
 * Preserves text & origin URL (including iframe selections), targets top frame (frameId: 0),
 * and dynamically injects content script with reliable acknowledgment when needed.
 */
export async function handleContextMenuClick(
  info: ContextMenuClickInfo,
  tab?: ContextMenuTargetTab
): Promise<boolean> {
  if (info.menuItemId !== CONTEXT_MENU_ITEM_ID || !tab?.id || !info.selectionText) {
    return false
  }

  const tabId = tab.id
  // Source URL captures iframe URL when available, otherwise page URL or tab URL
  const sourceUrl = info.frameUrl || info.pageUrl || tab.url || ''
  const topPageUrl = info.pageUrl || tab.url || ''

  // Reject internal or restricted pages
  if (isRestrictedUrl(topPageUrl)) {
    console.warn('[TabDo ContextMenu] Script injection not permitted on restricted URL:', topPageUrl)
    return false
  }

  const payload = {
    text: info.selectionText,
    url: sourceUrl,
  }

  // 1. Try sending directly to top frame (frameId: 0)
  const initialDelivered = await sendOpenDialogWithAck(tabId, payload, { frameId: 0 }, 1, 0)
  if (initialDelivered) {
    return true
  }

  // 2. If not acknowledged, dynamically inject into top frame on demand
  try {
    if (chrome.scripting?.executeScript) {
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: [0] },
        files: ['content-scripts/content.js'],
      })

      // 3. Send message with retry acknowledgment
      const deliveredAfterInject = await sendOpenDialogWithAck(tabId, payload, { frameId: 0 }, 5, 30)
      if (!deliveredAfterInject) {
        console.warn('[TabDo ContextMenu] Content script did not acknowledge open-dialog after injection.')
      }
      return deliveredAfterInject
    }
  } catch (err) {
    console.warn('[TabDo ContextMenu] Failed to inject content script:', err)
    return false
  }

  return false
}
