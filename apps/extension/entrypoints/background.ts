import { handleExtensionMessage } from '../lib/controller.js'
import {
  handleNotificationButtonClick,
  handleNotificationClicked,
  showReminderNotification,
} from '../lib/notifications.js'
import { PERIODIC_SYNC_ALARM_NAME, syncExtensionState } from '../lib/sync.js'

export default defineBackground(() => {
  // 1. Startup & install events
  chrome.runtime.onStartup.addListener(async () => {
    console.log('[TabDo Background] Browser startup, running sync...')
    await syncExtensionState()
  })

  chrome.runtime.onInstalled.addListener(async () => {
    console.log('[TabDo Background] Extension installed/updated, running sync...')
    await syncExtensionState()

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

    // Auto-inject content script into currently open tabs (e.g. Zalo Web) so users don't have to reload pages
    if (typeof chrome !== 'undefined' && chrome.scripting && chrome.tabs) {
      try {
        const openTabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] })
        for (const openTab of openTabs) {
          if (openTab.id && !openTab.url?.startsWith('chrome://') && !openTab.url?.startsWith('edge://')) {
            chrome.scripting.executeScript({
              target: { tabId: openTab.id, allFrames: true },
              files: ['content-scripts/content.js'],
            }).catch(() => {
              // Ignore tabs that disallow injection (internal edge/chrome pages)
            })
          }
        }
      } catch (err) {
        console.warn('[TabDo Background] Could not auto-inject into open tabs:', err)
      }
    }
  })

  // Context menu click handler with resilient fallback injection
  if (typeof chrome !== 'undefined' && chrome.contextMenus?.onClicked) {
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      if (info.menuItemId === 'tabdo:create-task-selection' && tab?.id && info.selectionText) {
        const tabId = tab.id
        const frameId = info.frameId
        const pageUrl = info.pageUrl || tab.url || ''
        const message = {
          type: 'tabdo:open-create-dialog',
          payload: {
            text: info.selectionText,
            url: pageUrl,
          },
        }

        try {
          await chrome.tabs.sendMessage(tabId, message, frameId !== undefined ? { frameId } : undefined)
        } catch {
          // Content script not ready in this tab. Dynamically inject and retry!
          try {
            if (chrome.scripting?.executeScript) {
              await chrome.scripting.executeScript({
                target: { tabId, allFrames: true },
                files: ['content-scripts/content.js'],
              })
              // Small delay for listener registration
              setTimeout(() => {
                chrome.tabs.sendMessage(tabId, message, frameId !== undefined ? { frameId } : undefined).catch(console.error)
              }, 80)
            }
          } catch (injectErr) {
            console.error('[TabDo Background] Could not dynamically inject content script:', injectErr)
          }
        }
      }
    })
  }

  // 2. Alarm triggers
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    console.log('[TabDo Background] Alarm event triggered:', alarm.name, new Date().toISOString())

    if (alarm.name === PERIODIC_SYNC_ALARM_NAME) {
      console.log('[TabDo Background] Running periodic sync...')
      await syncExtensionState()
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
      await showReminderNotification(alarm.name)
    }
  })

  // 3. Notification action buttons
  chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    console.log('[TabDo Background] Notification button clicked:', notificationId, buttonIndex)
    await handleNotificationButtonClick(notificationId, buttonIndex)
  })

  // 4. Notification body click
  chrome.notifications.onClicked.addListener(async (notificationId) => {
    console.log('[TabDo Background] Notification clicked:', notificationId)
    await handleNotificationClicked(notificationId)
  })

  // 5. Popup message routing
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleExtensionMessage(message)
      .then((res) => sendResponse(res))
      .catch((err) => {
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) })
      })
    return true // Keep channel open for async response
  })
})
