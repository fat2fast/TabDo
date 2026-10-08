import { describe, it, expect, beforeEach, vi } from 'vitest'
import { restoreSession, signIn, signOut } from '../auth.js'
import {
  storageGet,
  storageSet,
  getActiveUserId,
  AUTH_STORAGE_KEY,
} from '../storage.js'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('auth lifecycle', () => {
  let mockStore: Record<string, unknown> = {}
  let registeredAlarms: Array<{ name: string; scheduledTime?: number }> = []

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

  it('1. restore-success: restores valid session, validates user and fetches profile', async () => {
    const mockClient = {
      auth: {
        getSession: vi.fn(async () => ({
          data: {
            session: {
              user: { id: 'user-123', email: 'test@example.com' },
            },
          },
          error: null,
        })),
        getUser: vi.fn(async () => ({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        })),
        signOut: vi.fn(async () => ({ error: null })),
      },
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: { id: 'user-123', display_name: 'Phat Phung', timezone: 'Asia/Ho_Chi_Minh' },
              error: null,
            })),
          })),
        })),
      })),
    } as unknown as SupabaseClient

    const result = await restoreSession(mockClient)

    expect(result.status).toBe('authenticated')
    expect(result.user).toEqual({
      id: 'user-123',
      email: 'test@example.com',
      displayName: 'Phat Phung',
      timezone: 'Asia/Ho_Chi_Minh',
    })
    expect(await getActiveUserId()).toBe('user-123')
  })

  it('2. refresh-failure cleanup: clears user storage, reminder alarms, and returns unauthenticated state', async () => {
    await storageSet(AUTH_STORAGE_KEY, { token: 'invalid' })
    await storageSet('tabdo:auth:active_user_id', 'user-123')
    registeredAlarms.push(
      { name: 'reminder:user-123-alarm', scheduledTime: 12345 },
      { name: 'tabdo:sync:periodic' }
    )

    const mockClient = {
      auth: {
        getSession: vi.fn(async () => ({
          data: {
            session: { user: { id: 'user-123', email: 'test@example.com' } },
          },
          error: null,
        })),
        getUser: vi.fn(async () => ({
          data: { user: null },
          error: new Error('Token expired'),
        })),
        signOut: vi.fn(async () => ({ error: null })),
      },
    } as unknown as SupabaseClient

    const result = await restoreSession(mockClient)

    expect(result.status).toBe('unauthenticated')
    expect(result.user).toBeNull()
    expect(await getActiveUserId()).toBeNull()
    expect(await storageGet(AUTH_STORAGE_KEY)).toBeNull()

    // Invariant: Reminder alarms for previous session are cleared immediately
    expect(registeredAlarms.find((a) => a.name === 'reminder:user-123-alarm')).toBeUndefined()
    // Non-reminder alarms (such as periodic sync) are preserved
    expect(registeredAlarms.find((a) => a.name === 'tabdo:sync:periodic')).toBeDefined()
  })

  it('3. sign-out cleanup: clears active user, session token, and reminder alarms', async () => {
    await storageSet(AUTH_STORAGE_KEY, { token: 'valid' })
    await storageSet('tabdo:auth:active_user_id', 'user-123')
    registeredAlarms.push(
      { name: 'reminder:user-123-alarm-1', scheduledTime: 12345 },
      { name: 'reminder:user-123-alarm-2', scheduledTime: 67890 },
      { name: 'tabdo:sync:periodic' }
    )

    const mockClient = {
      auth: {
        signOut: vi.fn(async () => ({ error: null })),
      },
    } as unknown as SupabaseClient

    await signOut(mockClient)

    expect(mockClient.auth.signOut).toHaveBeenCalled()
    expect(await getActiveUserId()).toBeNull()
    expect(await storageGet(AUTH_STORAGE_KEY)).toBeNull()

    // Invariant: Reminder alarms must be removed during sign out
    expect(registeredAlarms.filter((a) => a.name.startsWith('reminder:'))).toHaveLength(0)
    // Invariant: Periodic sync alarm is preserved
    expect(registeredAlarms.find((a) => a.name === 'tabdo:sync:periodic')).toBeDefined()
  })
})
