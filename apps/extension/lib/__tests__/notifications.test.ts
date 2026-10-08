import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  BUTTON_DONE_LABEL,
  BUTTON_SNOOZE_LABEL,
  NOTIFICATION_BUTTON_DONE,
  NOTIFICATION_BUTTON_SNOOZE,
  getTaskDeepLinkUrl,
  handleDone,
  handleNotificationButtonClick,
  handleNotificationClicked,
  handleSnooze,
  showReminderNotification,
} from '../notifications.js'
import {
  getNotificationContext,
  getUserCache,
  setActiveUserId,
  setUserCache,
} from '../storage.js'
import type { ExtensionNotificationContext } from '../types.js'
import type { UpcomingReminder } from '@tabdo/types'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('notifications module', () => {
  let mockStore: Record<string, unknown> = {}
  let registeredNotifications: Record<string, unknown> = {}
  let clearedNotifications: string[] = []
  let updatedNotifications: Record<string, unknown> = {}
  let createdTabs: unknown[] = []
  let registeredAlarms: Array<{ name: string; scheduledTime?: number }> = []

  beforeEach(() => {
    mockStore = {}
    registeredNotifications = {}
    clearedNotifications = []
    updatedNotifications = {}
    createdTabs = []
    registeredAlarms = []

    const chromeMock = {
      storage: {
        local: {
          get: vi.fn(async (keys: string | string[]) => {
            if (typeof keys === 'string') return { [keys]: mockStore[keys] }
            const res: Record<string, unknown> = {}
            for (const k of keys) {
              if (mockStore[k] !== undefined) res[k] = mockStore[k]
            }
            return res
          }),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(mockStore, items)
          }),
          remove: vi.fn(async (keys: string | string[]) => {
            const arr = Array.isArray(keys) ? keys : [keys]
            for (const k of arr) delete mockStore[k]
          }),
        },
      },
      notifications: {
        create: vi.fn(async (id: string, options: unknown) => {
          registeredNotifications[id] = options
        }),
        update: vi.fn(async (id: string, options: unknown) => {
          updatedNotifications[id] = options
          if (registeredNotifications[id]) {
            Object.assign(registeredNotifications[id], options)
          }
          return true
        }),
        clear: vi.fn(async (id: string) => {
          clearedNotifications.push(id)
          delete registeredNotifications[id]
          return true
        }),
      },
      tabs: {
        create: vi.fn(async (options: unknown) => {
          createdTabs.push(options)
        }),
      },
      alarms: {
        getAll: vi.fn(async () => [...registeredAlarms]),
        get: vi.fn(async (name: string) => registeredAlarms.find((a) => a.name === name) || null),
        create: vi.fn((name: string, info: { when?: number }) => {
          registeredAlarms.push({ name, scheduledTime: info.when })
        }),
        clear: vi.fn(async (name: string) => {
          registeredAlarms = registeredAlarms.filter((a) => a.name !== name)
          return true
        }),
      },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.stubGlobal('chrome', chromeMock as any)
  })

  it('1. constants and deep link URL: validates button labels and encoded link format', () => {
    expect(BUTTON_DONE_LABEL).toBe('Hoàn thành')
    expect(BUTTON_SNOOZE_LABEL).toBe('Hoãn 15 phút')

    const url = getTaskDeepLinkUrl('123e4567-e89b-12d3-a456-426614174000')
    expect(url).toContain('/tasks/today?taskId=123e4567-e89b-12d3-a456-426614174000')
  })

  it('2. showReminderNotification: displays notification with cached context and best-effort triggers', async () => {
    await setActiveUserId('user-1')
    const sampleReminder: UpcomingReminder = {
      id: 'rem-100',
      taskId: 'task-100',
      taskTitle: 'Prepare presentation',
      taskStatus: 'todo',
      dueAt: '2026-10-06T12:00:00.000Z',
      reminderKind: 'absolute',
      offsetMinutes: null,
      remindAt: '2026-10-06T12:00:00.000Z',
      effectiveAt: '2026-10-06T12:00:00.000Z',
      status: 'pending',
      snoozedUntil: null,
      updatedAt: '2026-10-06T08:00:00.000Z',
      taskUpdatedAt: '2026-10-06T08:00:00.000Z',
    }

    await setUserCache('user-1', {
      userId: 'user-1',
      todayTasks: [],
      upcomingReminders: [sampleReminder],
      metadata: { lastSuccessfulSyncAt: null, lastSyncError: null, isStale: false },
    })

    let triggeredCalled = false
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'reminders') {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  select: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => {
                      triggeredCalled = true
                      return {
                        data: { id: 'rem-100', updated_at: '2026-10-06T08:05:00.000Z' },
                        error: null,
                      }
                    }),
                  })),
                })),
              })),
            })),
          }
        }
        return {}
      }),
    } as unknown as SupabaseClient

    await showReminderNotification('reminder:rem-100', mockClient)

    const notifKeys = Object.keys(registeredNotifications)
    expect(notifKeys).toHaveLength(1)
    const notif = registeredNotifications[notifKeys[0]!] as {
      title: string
      buttons: Array<{ title: string }>
    }
    expect(notif.title).toBe('Prepare presentation')
    expect(notif.buttons[0]?.title).toBe(BUTTON_DONE_LABEL)
    expect(notif.buttons[1]?.title).toBe(BUTTON_SNOOZE_LABEL)

    // Context persisted in storage with refreshed reminderUpdatedAt
    const context = await getNotificationContext(notifKeys[0]!)
    expect(context?.taskId).toBe('task-100')
    expect(context?.reminderId).toBe('rem-100')
    expect(context?.reminderUpdatedAt).toBe('2026-10-06T08:05:00.000Z')

    // Best-effort triggered executed
    expect(triggeredCalled).toBe(true)
  })

  it('3. missing context: does not display notification and skips inaccurate display', async () => {
    await setActiveUserId('user-1')
    await setUserCache('user-1', {
      userId: 'user-1',
      todayTasks: [],
      upcomingReminders: [],
      metadata: { lastSuccessfulSyncAt: null, lastSyncError: null, isStale: false },
    })

    const mockClient = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      },
    } as unknown as SupabaseClient

    await showReminderNotification('reminder:unknown-id', mockClient)

    expect(Object.keys(registeredNotifications)).toHaveLength(0)
  })

  it('4. handleNotificationClicked: creates web tab and clears notification', async () => {
    const context: ExtensionNotificationContext = {
      notificationId: 'notif-1',
      reminderId: 'rem-1',
      taskId: 'task-abc',
      taskTitle: 'Important task',
      dueAt: null,
      effectiveAt: '2026-10-06T12:00:00.000Z',
      reminderUpdatedAt: '2026-10-06T10:00:00.000Z',
      taskUpdatedAt: '2026-10-06T10:00:00.000Z',
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockStore['tabdo:notifications'] = { 'notif-1': context }

    await handleNotificationClicked('notif-1')

    expect(createdTabs).toHaveLength(1)
    expect((createdTabs[0] as { url: string }).url).toContain('/tasks/today?taskId=task-abc')
    expect(clearedNotifications).toContain('notif-1')
    expect(await getNotificationContext('notif-1')).toBeNull()
  })

  it('5. handleDone: marks task done remotely, clears task alarm, and syncs', async () => {
    registeredAlarms.push({ name: 'reminder:rem-1', scheduledTime: 12345 })

    const context: ExtensionNotificationContext = {
      notificationId: 'notif-1',
      reminderId: 'rem-1',
      taskId: 'task-1',
      taskTitle: 'Done test task',
      dueAt: null,
      effectiveAt: '2026-10-06T12:00:00.000Z',
      reminderUpdatedAt: '2026-10-06T10:00:00.000Z',
      taskUpdatedAt: '2026-10-06T10:00:00.000Z',
    }

    let taskCompleted = false
    const mockClient = {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: 'user-1', email: 'test@example.com' } } },
          error: null,
        })),
        getUser: vi.fn(async () => ({
          data: { user: { id: 'user-1', email: 'test@example.com' } },
          error: null,
        })),
      },
      from: vi.fn((table: string) => {
        if (table === 'tasks') {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  select: vi.fn(() => ({
                    single: vi.fn(async () => {
                      taskCompleted = true
                      return {
                        data: { id: 'task-1', title: 'Done test task', updated_at: '2026-10-06T11:00:00.000Z' },
                        error: null,
                      }
                    }),
                  })),
                })),
              })),
            })),
            select: vi.fn(() => ({
              neq: vi.fn(() => ({
                not: vi.fn(() => ({
                  lte: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(async () => ({ data: [], error: null })),
                    })),
                  })),
                })),
              })),
            })),
          }
        }
        if (table === 'task_activities') {
          return { insert: vi.fn(async () => ({ error: null })) }
        }
        if (table === 'profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { id: 'user-1', display_name: 'Phat', timezone: 'Asia/Ho_Chi_Minh' },
                  error: null,
                })),
              })),
            })),
          }
        }
        if (table === 'reminders') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lt: vi.fn(() => ({
                    order: vi.fn(async () => ({ data: [], error: null })),
                  })),
                })),
              })),
            })),
          }
        }
        return {}
      }),
    } as unknown as SupabaseClient

    await handleDone(context, mockClient)

    expect(taskCompleted).toBe(true)
    expect(registeredAlarms.find((a) => a.name === 'reminder:rem-1')).toBeUndefined()
  })

  it('6. handleSnooze: updates reminder remotely, creates rescheduled alarm, and syncs', async () => {
    registeredAlarms.push({ name: 'reminder:rem-1', scheduledTime: 12345 })

    const context: ExtensionNotificationContext = {
      notificationId: 'notif-1',
      reminderId: 'rem-1',
      taskId: 'task-1',
      taskTitle: 'Snooze test task',
      dueAt: null,
      effectiveAt: '2026-10-06T12:00:00.000Z',
      reminderUpdatedAt: '2026-10-06T10:00:00.000Z',
      taskUpdatedAt: '2026-10-06T10:00:00.000Z',
    }

    const futureInstant = '2026-10-06T12:15:00.000Z'
    const futureMs = new Date(futureInstant).getTime()

    const mockClient = {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: 'user-1', email: 'test@example.com' } } },
          error: null,
        })),
        getUser: vi.fn(async () => ({
          data: { user: { id: 'user-1', email: 'test@example.com' } },
          error: null,
        })),
      },
      from: vi.fn((table: string) => {
        if (table === 'reminders') {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  select: vi.fn(() => ({
                    single: vi.fn(async () => ({
                      data: {
                        id: 'rem-1',
                        snoozed_until: futureInstant,
                        effective_at: futureInstant,
                        updated_at: '2026-10-06T11:00:00.000Z',
                      },
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lt: vi.fn(() => ({
                    order: vi.fn(async () => ({
                      data: [
                        {
                          id: 'rem-1',
                          task_id: 'task-1',
                          remind_at: '2026-10-06T10:00:00.000Z',
                          status: 'snoozed',
                          snoozed_until: futureInstant,
                          reminder_kind: 'absolute',
                          offset_minutes: null,
                          effective_at: futureInstant,
                          updated_at: '2026-10-06T11:00:00.000Z',
                          tasks: {
                            id: 'task-1',
                            title: 'Snooze test task',
                            status: 'todo',
                            due_at: null,
                            updated_at: '2026-10-06T10:00:00.000Z',
                          },
                        },
                      ],
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          }
        }
        if (table === 'profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { id: 'user-1', display_name: 'Phat', timezone: 'Asia/Ho_Chi_Minh' },
                  error: null,
                })),
              })),
            })),
          }
        }
        if (table === 'tasks') {
          return {
            select: vi.fn(() => ({
              neq: vi.fn(() => ({
                not: vi.fn(() => ({
                  lte: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(async () => ({ data: [], error: null })),
                    })),
                  })),
                })),
              })),
            })),
          }
        }
        return {}
      }),
    } as unknown as SupabaseClient

    await handleSnooze(context, 15, mockClient)

    const updatedAlarm = registeredAlarms.find((a) => a.name === 'reminder:rem-1')
    expect(updatedAlarm).toBeDefined()
    expect(updatedAlarm?.scheduledTime).toBe(futureMs)
  })

  it('7. showReminderNotification then Snooze: models DB changed updated_at after markReminderTriggered and verifies Snooze succeeds', async () => {
    await setActiveUserId('user-1')
    const initialUpdatedAt = '2026-10-06T08:00:00.000Z'
    const newDbUpdatedAt = '2026-10-06T08:05:00.000Z'
    const futureSnoozeInstant = '2026-10-06T12:15:00.000Z'

    const sampleReminder: UpcomingReminder = {
      id: 'rem-snooze-test',
      taskId: 'task-snooze-test',
      taskTitle: 'Important meeting prep',
      taskStatus: 'todo',
      dueAt: '2026-10-06T12:00:00.000Z',
      reminderKind: 'absolute',
      offsetMinutes: null,
      remindAt: '2026-10-06T12:00:00.000Z',
      effectiveAt: '2026-10-06T12:00:00.000Z',
      status: 'pending',
      snoozedUntil: null,
      updatedAt: initialUpdatedAt,
      taskUpdatedAt: initialUpdatedAt,
    }

    await setUserCache('user-1', {
      userId: 'user-1',
      todayTasks: [],
      upcomingReminders: [sampleReminder],
      metadata: { lastSuccessfulSyncAt: null, lastSyncError: null, isStale: false },
    })

    let snoozeExecutedWithCorrectVersion = false
    const mockClient = {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: 'user-1', email: 'test@example.com' } } },
          error: null,
        })),
        getUser: vi.fn(async () => ({
          data: { user: { id: 'user-1', email: 'test@example.com' } },
          error: null,
        })),
      },
      from: vi.fn((table: string) => {
        if (table === 'reminders') {
          return {
            update: vi.fn((updatePayload: Record<string, unknown>) => ({
              eq: vi.fn((field1: string, val1: string) => ({
                eq: vi.fn((field2: string, val2: string) => {
                  if (updatePayload.status === 'triggered') {
                    // Triggered update matches initialUpdatedAt
                    expect(val2).toBe(initialUpdatedAt)
                    return {
                      select: vi.fn(() => ({
                        maybeSingle: vi.fn(async () => ({
                          data: { id: 'rem-snooze-test', updated_at: newDbUpdatedAt },
                          error: null,
                        })),
                      })),
                    }
                  }

                  if (updatePayload.status === 'snoozed') {
                    // SNOOZE UPDATE MUST MATCH THE NEW DB UPDATED_AT (not the stale initialUpdatedAt!)
                    expect(val2).toBe(newDbUpdatedAt)
                    snoozeExecutedWithCorrectVersion = true
                    return {
                      select: vi.fn(() => ({
                        single: vi.fn(async () => ({
                          data: {
                            id: 'rem-snooze-test',
                            snoozed_until: futureSnoozeInstant,
                            effective_at: futureSnoozeInstant,
                            updated_at: '2026-10-06T08:20:00.000Z',
                          },
                          error: null,
                        })),
                      })),
                    }
                  }

                  return {}
                }),
              })),
            })),
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lt: vi.fn(() => ({
                    order: vi.fn(async () => ({ data: [], error: null })),
                  })),
                })),
              })),
            })),
          }
        }
        if (table === 'profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { id: 'user-1', display_name: 'Phat', timezone: 'Asia/Ho_Chi_Minh' },
                  error: null,
                })),
              })),
            })),
          }
        }
        if (table === 'tasks') {
          return {
            select: vi.fn(() => ({
              neq: vi.fn(() => ({
                not: vi.fn(() => ({
                  lte: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(async () => ({ data: [], error: null })),
                    })),
                  })),
                })),
              })),
            })),
          }
        }
        return {}
      }),
    } as unknown as SupabaseClient

    // 1. Show notification -> marks triggered and refreshes context with newDbUpdatedAt
    await showReminderNotification('reminder:rem-snooze-test', mockClient)
    const notifId = Object.keys(registeredNotifications)[0]!
    const savedContext = await getNotificationContext(notifId)
    expect(savedContext?.reminderUpdatedAt).toBe(newDbUpdatedAt)

    // 2. User clicks Snooze 15m button
    await handleNotificationButtonClick(notifId, NOTIFICATION_BUTTON_SNOOZE, mockClient)

    expect(snoozeExecutedWithCorrectVersion).toBe(true)
    expect(clearedNotifications).toContain(notifId)
    expect(await getNotificationContext(notifId)).toBeNull()
  })

  it('8. handleNotificationButtonClick Done failure: preserves notification and context, records lastSyncError', async () => {
    await setActiveUserId('user-1')
    await setUserCache('user-1', {
      userId: 'user-1',
      todayTasks: [],
      upcomingReminders: [],
      metadata: { lastSuccessfulSyncAt: null, lastSyncError: null, isStale: false },
    })

    const notifId = 'notif-fail-done'
    const context: ExtensionNotificationContext = {
      notificationId: notifId,
      reminderId: 'rem-fail',
      taskId: 'task-fail',
      taskTitle: 'Critical task',
      dueAt: null,
      effectiveAt: '2026-10-06T12:00:00.000Z',
      reminderUpdatedAt: '2026-10-06T10:00:00.000Z',
      taskUpdatedAt: '2026-10-06T10:00:00.000Z',
    }
    mockStore['tabdo:notifications'] = { [notifId]: context }
    registeredNotifications[notifId] = { title: 'Critical task', message: 'test' }

    const mockClientFail = {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: 'user-1', email: 'test@example.com' } } },
          error: null,
        })),
        getUser: vi.fn(async () => ({
          data: { user: { id: 'user-1', email: 'test@example.com' } },
          error: null,
        })),
      },
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { id: 'user-1', display_name: 'Phat', timezone: 'Asia/Ho_Chi_Minh' },
                  error: null,
                })),
              })),
            })),
          }
        }
        if (table === 'tasks') {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  select: vi.fn(() => ({
                    single: vi.fn(async () => ({
                      data: null,
                      error: new Error('Network connection failed'),
                    })),
                  })),
                })),
              })),
            })),
          }
        }
        return {}
      }),
    } as unknown as SupabaseClient

    await expect(
      handleNotificationButtonClick(notifId, NOTIFICATION_BUTTON_DONE, mockClientFail)
    ).rejects.toThrow('Network connection failed')

    // Invariant: Notification must NOT be dismissed on failure!
    expect(clearedNotifications).not.toContain(notifId)
    // Invariant: Context must NOT be deleted so user can retry or recover!
    expect(await getNotificationContext(notifId)).not.toBeNull()
    // User cache metadata records error
    const cache = await getUserCache('user-1')
    expect(cache?.metadata.lastSyncError).toContain('Network connection failed')
    expect(cache?.metadata.isStale).toBe(true)
    // Notification UI updated to reflect failure
    expect(updatedNotifications[notifId]).toBeDefined()
  })

  it('9. handleNotificationButtonClick Snooze failure: preserves notification and context on conflict', async () => {
    await setActiveUserId('user-1')
    await setUserCache('user-1', {
      userId: 'user-1',
      todayTasks: [],
      upcomingReminders: [],
      metadata: { lastSuccessfulSyncAt: null, lastSyncError: null, isStale: false },
    })

    const notifId = 'notif-fail-snooze'
    const context: ExtensionNotificationContext = {
      notificationId: notifId,
      reminderId: 'rem-conflict',
      taskId: 'task-conflict',
      taskTitle: 'Conflict task',
      dueAt: null,
      effectiveAt: '2026-10-06T12:00:00.000Z',
      reminderUpdatedAt: '2026-10-06T10:00:00.000Z',
      taskUpdatedAt: '2026-10-06T10:00:00.000Z',
    }
    mockStore['tabdo:notifications'] = { [notifId]: context }
    registeredNotifications[notifId] = { title: 'Conflict task', message: 'test' }

    const mockClientConflict = {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: 'user-1', email: 'test@example.com' } } },
          error: null,
        })),
        getUser: vi.fn(async () => ({
          data: { user: { id: 'user-1', email: 'test@example.com' } },
          error: null,
        })),
      },
      from: vi.fn((table: string) => {
        if (table === 'reminders') {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  select: vi.fn(() => ({
                    single: vi.fn(async () => ({
                      data: null,
                      error: { code: 'PGRST116', message: 'Row not found' },
                    })),
                  })),
                })),
              })),
            })),
          }
        }
        return {}
      }),
    } as unknown as SupabaseClient

    await expect(
      handleNotificationButtonClick(notifId, NOTIFICATION_BUTTON_SNOOZE, mockClientConflict)
    ).rejects.toThrow('concurrent modification conflict')

    // Invariant: Notification must NOT be dismissed on conflict!
    expect(clearedNotifications).not.toContain(notifId)
    // Invariant: Context must NOT be deleted!
    expect(await getNotificationContext(notifId)).not.toBeNull()
    // User cache metadata records error
    const cache = await getUserCache('user-1')
    expect(cache?.metadata.lastSyncError).toContain('concurrent modification conflict')
    expect(cache?.metadata.isStale).toBe(true)
  })
})
