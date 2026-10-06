import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  storageGet,
  storageSet,
  storageRemove,
  getUserCache,
  setUserCache,
  clearUserStorage,
  getNotificationContext,
  setNotificationContext,
  removeNotificationContext,
  clearAllAuthAndUserStorage,
  getActiveUserId,
  setActiveUserId,
  AUTH_STORAGE_KEY,
  ACTIVE_USER_ID_KEY,
  NOTIFICATIONS_STORAGE_KEY,
} from '../storage.js'
import type { ExtensionNotificationContext, ExtensionUserCache } from '../types.js'

describe('storage', () => {
  let mockStore: Record<string, unknown> = {}

  beforeEach(() => {
    mockStore = {}
    const chromeMock = {
      storage: {
        local: {
          get: vi.fn(async (keys: string | string[]) => {
            if (typeof keys === 'string') {
              return { [keys]: mockStore[keys] }
            }
            const res: Record<string, unknown> = {}
            for (const k of keys) {
              if (mockStore[k] !== undefined) {
                res[k] = mockStore[k]
              }
            }
            return res
          }),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(mockStore, items)
          }),
          remove: vi.fn(async (keys: string | string[]) => {
            const arr = Array.isArray(keys) ? keys : [keys]
            for (const k of arr) {
              delete mockStore[k]
            }
          }),
        },
      },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.stubGlobal('chrome', chromeMock as any)
  })

  it('gets, sets, and removes values through typed promise wrappers', async () => {
    await storageSet('myKey', { foo: 'bar' })
    const value = await storageGet<{ foo: string }>('myKey')
    expect(value).toEqual({ foo: 'bar' })

    await storageRemove('myKey')
    const cleared = await storageGet('myKey')
    expect(cleared).toBeNull()
  })

  it('isolates user cache by user id namespace', async () => {
    const user1Cache: ExtensionUserCache = {
      userId: 'user-1',
      todayTasks: [],
      upcomingReminders: [],
      metadata: { lastSuccessfulSyncAt: null, lastSyncError: null, isStale: false },
    }
    const user2Cache: ExtensionUserCache = {
      userId: 'user-2',
      todayTasks: [],
      upcomingReminders: [],
      metadata: { lastSuccessfulSyncAt: '2026-10-06T10:00:00.000Z', lastSyncError: null, isStale: false },
    }

    await setUserCache('user-1', user1Cache)
    await setUserCache('user-2', user2Cache)

    const fetched1 = await getUserCache('user-1')
    const fetched2 = await getUserCache('user-2')

    expect(fetched1?.userId).toBe('user-1')
    expect(fetched2?.userId).toBe('user-2')
    expect(fetched1?.metadata.lastSuccessfulSyncAt).toBeNull()
    expect(fetched2?.metadata.lastSuccessfulSyncAt).toBe('2026-10-06T10:00:00.000Z')
  })

  it('manages notification context safely', async () => {
    const ctx: ExtensionNotificationContext = {
      notificationId: 'notif-1',
      reminderId: 'rem-1',
      taskId: 'task-1',
      taskTitle: 'Finish report',
      dueAt: null,
      effectiveAt: '2026-10-06T12:00:00.000Z',
      reminderUpdatedAt: '2026-10-06T10:00:00.000Z',
      taskUpdatedAt: '2026-10-06T10:00:00.000Z',
    }

    await setNotificationContext('notif-1', ctx)
    const fetched = await getNotificationContext('notif-1')
    expect(fetched).toEqual(ctx)

    await removeNotificationContext('notif-1')
    const removed = await getNotificationContext('notif-1')
    expect(removed).toBeNull()
  })

  it('clearUserStorage removes specific user cache and notifications', async () => {
    await setUserCache('user-1', {
      userId: 'user-1',
      todayTasks: [],
      upcomingReminders: [],
      metadata: { lastSuccessfulSyncAt: null, lastSyncError: null, isStale: false },
    })
    await setNotificationContext('notif-1', {
      notificationId: 'notif-1',
      reminderId: 'rem-1',
      taskId: 'task-1',
      taskTitle: 'Task',
      dueAt: null,
      effectiveAt: '',
      reminderUpdatedAt: '',
      taskUpdatedAt: '',
    })

    await clearUserStorage('user-1')

    expect(await getUserCache('user-1')).toBeNull()
    expect(await getNotificationContext('notif-1')).toBeNull()
  })

  it('clearAllAuthAndUserStorage clears session, active user, user cache, and notifications', async () => {
    await storageSet(AUTH_STORAGE_KEY, { access_token: 'fake' })
    await setActiveUserId('user-1')
    await setUserCache('user-1', {
      userId: 'user-1',
      todayTasks: [],
      upcomingReminders: [],
      metadata: { lastSuccessfulSyncAt: null, lastSyncError: null, isStale: false },
    })
    await setNotificationContext('notif-1', {
      notificationId: 'notif-1',
      reminderId: 'rem-1',
      taskId: 'task-1',
      taskTitle: 'Task',
      dueAt: null,
      effectiveAt: '',
      reminderUpdatedAt: '',
      taskUpdatedAt: '',
    })

    await clearAllAuthAndUserStorage()

    expect(await storageGet(AUTH_STORAGE_KEY)).toBeNull()
    expect(await getActiveUserId()).toBeNull()
    expect(await getUserCache('user-1')).toBeNull()
    expect(await storageGet(NOTIFICATIONS_STORAGE_KEY)).toBeNull()
  })
})
