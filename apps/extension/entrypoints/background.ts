import {
  controllerMutex,
  handleExtensionMessage,
  runSerializedSync,
} from '../lib/controller.js'
import {
  handleNotificationButtonClick,
  handleNotificationClicked,
  showReminderNotification,
} from '../lib/notifications.js'
import { handleContextMenuClick } from '../lib/context-menu.js'
import { PERIODIC_SYNC_ALARM_NAME } from '../lib/sync.js'

export async function syncPillScriptRegistration(enabled: boolean) {
  if (typeof chrome === 'undefined' || !chrome.scripting?.registerContentScripts) {
    return
  }

  try {
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: ['tabdo-pill-content'] })
    if (enabled) {
      const hasPerm = chrome.permissions?.contains
        ? (await chrome.permissions.contains({ origins: ['*://*/*'] }).catch(() => false))
          || (await chrome.permissions.contains({ origins: ['https://*/*', 'http://*/*'] }).catch(() => false))
        : false
      if (hasPerm && existing.length === 0) {
        await chrome.scripting.registerContentScripts([
          {
            id: 'tabdo-pill-content',
            js: ['content-scripts/content.js'],
            matches: ['*://*/*'],
            runAt: 'document_idle',
          },
        ])
        console.log('[TabDo Background] Registered tabdo-pill-content dynamic content script.')
      }
    } else {
      if (existing.length > 0) {
        await chrome.scripting.unregisterContentScripts({ ids: ['tabdo-pill-content'] })
        console.log('[TabDo Background] Unregistered tabdo-pill-content dynamic content script.')
      }
    }
  } catch (err) {
    console.warn('[TabDo Background] Error syncing pill content script:', err)
  }
}

export default defineBackground(() => {
  // 1. Startup & install events
  chrome.runtime.onStartup.addListener(async () => {
    console.log('[TabDo Background] Browser startup, running serialized sync...')
    await runSerializedSync()
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const stored = await chrome.storage.local.get('quickPillEnabled')
      await syncPillScriptRegistration(Boolean(stored?.quickPillEnabled))
    }
  })

  chrome.runtime.onInstalled.addListener(async () => {
    console.log('[TabDo Background] Extension installed/updated, running serialized sync...')
    await runSerializedSync()
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const stored = await chrome.storage.local.get('quickPillEnabled')
      await syncPillScriptRegistration(Boolean(stored?.quickPillEnabled))
    }

    // Create selection context menu
    if (typeof chrome !== 'undefined' && chrome.contextMenus?.create) {
      chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
          id: 'tabdo:create-task-selection',
          title: 'Tạo công việc TabDo từ "%s"',
          contexts: ['selection'],
        })
      })
    }
  })

  // 1b. Permissions lifecycle events
  if (typeof chrome !== 'undefined' && chrome.permissions?.onAdded) {
    chrome.permissions.onAdded.addListener(async (permissions) => {
      console.log('[TabDo Background] Permissions added:', permissions)
      const hasWildcard = permissions.origins?.some((o) => o.includes('*')) ?? false
      if (hasWildcard) {
        if (chrome.storage?.local?.set) {
          await chrome.storage.local.set({ quickPillEnabled: true })
        }
        await syncPillScriptRegistration(true)
      }
    })
  }

  if (typeof chrome !== 'undefined' && chrome.permissions?.onRemoved) {
    chrome.permissions.onRemoved.addListener(async (permissions) => {
      console.log('[TabDo Background] Permissions removed:', permissions)
      const hasWildcard = permissions.origins?.some((o) => o.includes('*')) ?? false
      if (hasWildcard) {
        if (chrome.storage?.local?.set) {
          await chrome.storage.local.set({ quickPillEnabled: false })
        }
        await syncPillScriptRegistration(false)
      }
    })
  }

  // Context menu click handler with on-demand user-triggered injection
  if (typeof chrome !== 'undefined' && chrome.contextMenus?.onClicked) {
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      await handleContextMenuClick(info, tab)
    })
  }

  // 2. Alarm triggers
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    console.log('[TabDo Background] Alarm event triggered:', alarm.name, new Date().toISOString())

    if (alarm.name === PERIODIC_SYNC_ALARM_NAME) {
      console.log('[TabDo Background] Running periodic serialized sync...')
      await runSerializedSync()
      return
    }

    // Support diagnostic test alarms (e.g. test:quick_alarm or test:notification)
    if (alarm.name.startsWith('test:')) {
      console.log('[TabDo Background] Test alarm fired successfully:', alarm.name)
      const iconUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL
        ? chrome.runtime.getURL('icon/128.png')
        : '/icon/128.png'

      await chrome.notifications.create(`test-alarm-${Date.now()}`, {
        type: 'basic',
        iconUrl,
        title: 'TabDo Alarm Test Thành Công! 🔔',
        message: `Báo thức (${alarm.name}) đã kích hoạt thành công trên MS Edge!`,
        buttons: [{ title: 'Đã hiểu' }],
        requireInteraction: true,
      })
      return
    }

    if (alarm.name.startsWith('reminder:')) {
      console.log('[TabDo Background] Showing reminder notification for:', alarm.name)
      await controllerMutex.runExclusive(async () => {
        await showReminderNotification(alarm.name)
      })
    }
  })

  // 3. Notification action buttons
  chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    console.log('[TabDo Background] Notification button clicked:', notificationId, buttonIndex)
    try {
      await handleNotificationButtonClick(notificationId, buttonIndex)
    } catch (err) {
      console.error('[TabDo Background] Notification button handler failed:', err)
    }
  })

  // 4. Notification body click
  chrome.notifications.onClicked.addListener(async (notificationId) => {
    console.log('[TabDo Background] Notification clicked:', notificationId)
    await handleNotificationClicked(notificationId)
  })

  // 5. Popup message routing
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'tabdo:sync-pill-script') {
      syncPillScriptRegistration(Boolean(message.payload?.enabled))
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: String(err) }))
      return true
    }

    handleExtensionMessage(message)
      .then((res) => sendResponse(res))
      .catch((err) => {
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) })
      })
    return true // Keep channel open for async response
  })
})
