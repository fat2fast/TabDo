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
import { PERIODIC_SYNC_ALARM_NAME } from '../lib/sync.js'

export default defineBackground(() => {
  // 1. Startup & install events
  chrome.runtime.onStartup.addListener(async () => {
    console.log('[TabDo Background] Browser startup, running serialized sync...')
    await runSerializedSync()
  })

  chrome.runtime.onInstalled.addListener(async () => {
    console.log('[TabDo Background] Extension installed/updated, running serialized sync...')
    await runSerializedSync()

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

  // Context menu click handler with on-demand user-triggered injection
  if (typeof chrome !== 'undefined' && chrome.contextMenus?.onClicked) {
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      if (info.menuItemId === 'tabdo:create-task-selection' && tab?.id && info.selectionText) {
        const tabId = tab.id
        const frameId = info.frameId
        const pageUrl = info.pageUrl || tab.url || ''

        // Gracefully ignore internal/restricted pages where injection is unsupported
        if (
          !pageUrl ||
          pageUrl.startsWith('chrome://') ||
          pageUrl.startsWith('edge://') ||
          pageUrl.startsWith('about:') ||
          pageUrl.startsWith('chrome-extension://') ||
          pageUrl.startsWith('devtools://') ||
          pageUrl.startsWith('view-source:')
        ) {
          console.warn('[TabDo Background] Script injection not permitted on restricted URL:', pageUrl)
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
          await chrome.tabs.sendMessage(tabId, message, targetOptions)
        } catch {
          // Content script not ready in this tab; inject on demand
          try {
            if (chrome.scripting?.executeScript) {
              await chrome.scripting.executeScript({
                target: { tabId, allFrames: false },
                files: ['content-scripts/content.js'],
              })
              // Small delay for listener registration
              setTimeout(() => {
                chrome.tabs.sendMessage(tabId, message, targetOptions).catch((err) => {
                  console.warn('[TabDo Background] Failed to send open-dialog message after injection:', err)
                })
              }, 60)
            }
          } catch (injectErr) {
            console.warn('[TabDo Background] Could not dynamically inject content script:', injectErr)
          }
        }
      }
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
    handleExtensionMessage(message)
      .then((res) => sendResponse(res))
      .catch((err) => {
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) })
      })
    return true // Keep channel open for async response
  })
})
