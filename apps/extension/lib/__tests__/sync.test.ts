import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  syncExtensionState,
  PERIODIC_SYNC_ALARM_NAME,
  SYNC_INTERVAL_MINUTES,
} from '../sync.js'
import { getUserCache, setUserCache } from '../storage.js'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('syncExtensionState', () => {
  let mockStore: Record<string, unknown> = {}
  let registeredAlarms: Array<{ name: string; scheduledTime?: number; periodInMinutes?: number }> = []

  beforeEach(() => {
    mockStore = {}
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
      alarms: {
        getAll: vi.fn(async () => [...registeredAlarms]),
        get: vi.fn(async (name: string) => registeredAlarms.find((a) => a.name === name) || null),
        create: vi.fn((name: string, info: { when?: number; periodInMinutes?: number }) => {
          registeredAlarms.push({ name, scheduledTime: info.when, periodInMinutes: info.periodInMinutes })
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

  it('1. startup sync: converges remote reminders to Chrome alarms and creates 15m periodic sync', async () => {
    const t1 = new Date('2026-10-06T10:00:00.000Z').getTime()

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
                      limit: vi.fn(async () => ({
                        data: [
                          {
                            id: 'task-1',
                            title: 'Finish extension',
                            status: 'todo',
                            priority: 'high',
                            due_date_kind: 'date_time',
                            due_at: '2026-10-06T10:00:00.000Z',
                            updated_at: '2026-10-06T08:00:00.000Z',
                          },
                        ],
                        error: null,
                      })),
                    })),
                  })),
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
                    order: vi.fn(async () => ({
                      data: [
                        {
                          id: 'rem-1',
                          task_id: 'task-1',
                          remind_at: '2026-10-06T10:00:00.000Z',
                          status: 'pending',
                          snoozed_until: null,
                          reminder_kind: 'absolute',
                          offset_minutes: null,
                          effective_at: '2026-10-06T10:00:00.000Z',
                          updated_at: '2026-10-06T08:00:00.000Z',
                          tasks: {
                            id: 'task-1',
                            title: 'Finish extension',
                            status: 'todo',
                            due_at: '2026-10-06T10:00:00.000Z',
                            updated_at: '2026-10-06T08:00:00.000Z',
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
        return {}
      }),
    } as unknown as SupabaseClient

    const result = await syncExtensionState(mockClient)

    expect(result.status).toBe('authenticated')
    expect(result.todayTasks).toHaveLength(1)
    expect(result.syncMetadata.lastSuccessfulSyncAt).not.toBeNull()

    // Alarm converged
    const reminderAlarm = registeredAlarms.find((a) => a.name === 'reminder:rem-1')
    expect(reminderAlarm).toBeDefined()
    expect(reminderAlarm?.scheduledTime).toBe(t1)

    // Periodic sync alarm
    const syncAlarm = registeredAlarms.find((a) => a.name === PERIODIC_SYNC_ALARM_NAME)
    expect(syncAlarm).toBeDefined()
    expect(syncAlarm?.periodInMinutes).toBe(SYNC_INTERVAL_MINUTES)
  })

  it('2. orphan removal: clears stale alarms not in remote projection', async () => {
    // Existing orphaned alarm
    registeredAlarms.push({ name: 'reminder:stale-rem', scheduledTime: 12345 })

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

    await syncExtensionState(mockClient)

    expect(registeredAlarms.find((a) => a.name === 'reminder:stale-rem')).toBeUndefined()
  })

  it('3. fetch failure: retains prior cache, records stale marker and does NOT mutate alarms', async () => {
    // Initial cache and alarm
    await setUserCache('user-1', {
      userId: 'user-1',
      todayTasks: [
        {
          id: 'task-1',
          title: 'Existing task',
          status: 'todo',
          priority: 'medium',
          dueDateKind: 'date_time',
          dueAt: null,
          updatedAt: '2026-10-06T00:00:00.000Z',
        },
      ],
      upcomingReminders: [],
      metadata: {
        lastSuccessfulSyncAt: '2026-10-06T00:00:00.000Z',
        lastSyncError: null,
        isStale: false,
      },
    })
    registeredAlarms.push({ name: 'reminder:existing', scheduledTime: 99999 })

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
        throw new Error('Network failure')
      }),
    } as unknown as SupabaseClient

    const result = await syncExtensionState(mockClient)

    expect(result.syncMetadata.isStale).toBe(true)
    expect(result.syncMetadata.lastSyncError).toContain('Network failure')
    expect(result.todayTasks).toHaveLength(1)
    // Alarms must NOT have been destroyed
    expect(registeredAlarms.find((a) => a.name === 'reminder:existing')).toBeDefined()
  })
})
