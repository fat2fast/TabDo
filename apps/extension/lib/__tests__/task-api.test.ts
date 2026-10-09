import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  quickAddTask,
  completeTask,
  markReminderTriggered,
  snoozeReminder,
} from '@tabdo/supabase'
import { handleExtensionMessage } from '../controller.js'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('task and reminder API boundaries', () => {
  let mockStore: Record<string, unknown> = {}

  beforeEach(() => {
    mockStore = {}
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
      tabs: {
        create: vi.fn(),
      },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.stubGlobal('chrome', chromeMock as any)
  })

  it('1. title validation: rejects blank and overly long titles', async () => {
    const mockClient = {} as unknown as SupabaseClient

    await expect(quickAddTask(mockClient, 'user-1', '')).rejects.toThrow(
      'Task title cannot be blank'
    )
    await expect(quickAddTask(mockClient, 'user-1', '   ')).rejects.toThrow(
      'Task title cannot be blank'
    )
    await expect(quickAddTask(mockClient, 'user-1', 'a'.repeat(501))).rejects.toThrow(
      'Task title cannot exceed 500 characters'
    )
  })

  it('2. authenticated insert: inserts task with user_id and records created activity', async () => {
    const insertedRows: unknown[] = []
    const activityRows: unknown[] = []

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'tasks') {
          return {
            insert: vi.fn((payload: unknown) => {
              insertedRows.push(payload)
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: {
                      id: 'task-1',
                      title: 'Buy groceries',
                      status: 'todo',
                      priority: 'medium',
                      due_date_kind: 'date_time',
                      due_at: null,
                      updated_at: '2026-10-06T10:00:00.000Z',
                    },
                    error: null,
                  })),
                })),
              }
            }),
          }
        }
        if (table === 'task_activities') {
          return {
            insert: vi.fn(async (payload: unknown) => {
              activityRows.push(payload)
              return { error: null }
            }),
          }
        }
        return {}
      }),
    } as unknown as SupabaseClient

    const result = await quickAddTask(mockClient, 'user-123', '  Buy groceries  ')

    expect(result.id).toBe('task-1')
    expect(result.title).toBe('Buy groceries')
    expect(insertedRows).toEqual([
      {
        user_id: 'user-123',
        title: 'Buy groceries',
        description: null,
        status: 'todo',
        priority: 'medium',
        due_date_kind: 'date_only',
        due_at: expect.any(String),
        source_url: null,
      },
    ])
    expect(activityRows).toEqual([
      {
        user_id: 'user-123',
        task_id: 'task-1',
        action: 'created',
        metadata: { title: 'Buy groceries' },
      },
    ])
  })

  it('3. completion compare condition: marks done with concurrency check or throws conflict error via RPC', async () => {
    const mockClientConflict = {
      rpc: vi.fn(async (fn: string) => {
        if (fn === 'complete_task_and_generate_next') {
          return { data: null, error: { code: '40001', message: 'Task was modified concurrently' } }
        }
        return { data: null, error: null }
      }),
    } as unknown as SupabaseClient

    await expect(
      completeTask(mockClientConflict, 'user-1', 'task-1', '2026-10-06T09:00:00.000Z')
    ).rejects.toThrow('concurrent modification conflict')

    expect(mockClientConflict.rpc).toHaveBeenCalledWith('complete_task_and_generate_next', {
      p_task_id: 'task-1',
      p_expected_updated_at: '2026-10-06T09:00:00.000Z',
    })
  })

  it('4. triggered best-effort behavior: catches and swallows error gracefully', async () => {
    const mockClientFail = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: null,
                error: new Error('Network error'),
              })),
            })),
          })),
        })),
      })),
    } as unknown as SupabaseClient

    const res = await markReminderTriggered(mockClientFail, 'rem-1')
    expect(res.success).toBe(false)

    const mockClientSuccess = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: 'rem-1', updated_at: '2026-10-06T12:00:01.000Z' },
                error: null,
              })),
            })),
          })),
        })),
      })),
    } as unknown as SupabaseClient

    const successRes = await markReminderTriggered(mockClientSuccess, 'rem-1')
    expect(successRes.success).toBe(true)
    expect(successRes.updatedAt).toBe('2026-10-06T12:00:01.000Z')
  })

  it('5. snooze conflict behavior: throws concurrency error on outdated update', async () => {
    const mockClientConflict = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: null,
                  error: { code: 'PGRST116', message: 'No rows updated' },
                })),
              })),
            })),
          })),
        })),
      })),
    } as unknown as SupabaseClient

    await expect(
      snoozeReminder(
        mockClientConflict,
        'rem-1',
        15,
        '2026-10-06T09:00:00.000Z',
        new Date('2026-10-06T10:00:00.000Z')
      )
    ).rejects.toThrow('concurrent modification conflict')
  })

  it('5b. snooze success: updates status and snoozed_until without generated column effective_at', async () => {
    let updatePayload: unknown = null
    const mockClientSuccess = {
      from: vi.fn(() => ({
        update: vi.fn((payload: unknown) => {
          updatePayload = payload
          return {
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: {
                      id: 'rem-1',
                      snoozed_until: '2026-10-06T10:15:00.000Z',
                      effective_at: '2026-10-06T10:15:00.000Z',
                      updated_at: '2026-10-06T10:00:01.000Z',
                    },
                    error: null,
                  })),
                })),
              })),
            })),
          }
        }),
      })),
    } as unknown as SupabaseClient

    const res = await snoozeReminder(
      mockClientSuccess,
      'rem-1',
      15,
      '2026-10-06T09:00:00.000Z',
      new Date('2026-10-06T10:00:00.000Z')
    )

    expect(res.id).toBe('rem-1')
    expect(updatePayload).toEqual({
      status: 'snoozed',
      snoozed_until: '2026-10-06T10:15:00.000Z',
    })
    expect((updatePayload as Record<string, unknown>).effective_at).toBeUndefined()
  })

  it('6. message result serialization: controller returns discriminated result', async () => {
    const mockClient = {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: null },
          error: null,
        })),
        getUser: vi.fn(async () => ({
          data: { user: null },
          error: null,
        })),
      },
    } as unknown as SupabaseClient

    // Quick-add when unauthenticated
    const res = await handleExtensionMessage(
      { type: 'quick-add', payload: { title: 'Test' } },
      mockClient
    )

    expect(res).toEqual({ ok: false, error: 'Not authenticated' })

    // Open task message
    const openRes = await handleExtensionMessage(
      { type: 'open-task', payload: { taskId: '123e4567-e89b-12d3-a456-426614174000' } },
      mockClient
    )
    expect(openRes.ok).toBe(true)
    if (openRes.ok) {
      expect((openRes.data as { url: string }).url).toContain('/tasks/today?taskId=123e4567-e89b-12d3-a456-426614174000')
    }
  })
})
