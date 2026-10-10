import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchSummaryData } from '../api/summary'

describe('Summary API', () => {
  const timeZone = 'Asia/Ho_Chi_Minh'
  const selectedDateStr = '2026-10-10'
  const now = new Date('2026-10-10T05:00:00.000Z')

  function createMockSupabase(
    tableHandlers: Record<string, (callCount: number) => { data: any[] | null; error: any }>
  ): { client: SupabaseClient; calls: { table: string; method: string; args: any[] }[] } {
    const calls: { table: string; method: string; args: any[] }[] = []
    const callCounters: Record<string, number> = {}

    const client = {
      from: vi.fn((table: string) => {
        calls.push({ table, method: 'from', args: [table] })
        const builder: any = {
          select: vi.fn((...args: any[]) => {
            calls.push({ table, method: 'select', args })
            return builder
          }),
          gte: vi.fn((...args: any[]) => {
            calls.push({ table, method: 'gte', args })
            return builder
          }),
          gt: vi.fn((...args: any[]) => {
            calls.push({ table, method: 'gt', args })
            return builder
          }),
          lt: vi.fn((...args: any[]) => {
            calls.push({ table, method: 'lt', args })
            return builder
          }),
          neq: vi.fn((...args: any[]) => {
            calls.push({ table, method: 'neq', args })
            return builder
          }),
          eq: vi.fn((...args: any[]) => {
            calls.push({ table, method: 'eq', args })
            return builder
          }),
          in: vi.fn((...args: any[]) => {
            calls.push({ table, method: 'in', args })
            return builder
          }),
          range: vi.fn((from: number, to: number) => {
            calls.push({ table, method: 'range', args: [from, to] })
            callCounters[table] = (callCounters[table] ?? 0) + 1
            const handler = tableHandlers[table] ?? (() => ({ data: [], error: null }))
            return Promise.resolve(handler(callCounters[table]))
          }),
          then: (onfulfilled: any, onrejected: any) => {
            callCounters[table] = (callCounters[table] ?? 0) + 1
            const handler = tableHandlers[table] ?? (() => ({ data: [], error: null }))
            return Promise.resolve(handler(callCounters[table])).then(onfulfilled, onrejected)
          },
        }
        return builder
      }),
    } as unknown as SupabaseClient

    return { client, calls }
  }

  it('queries bounded half-open ranges and schedule overlap', async () => {
    const { client, calls } = createMockSupabase({
      tasks: () => ({ data: [], error: null }),
      schedule_blocks: () => ({ data: [], error: null }),
      task_activities: () => ({ data: [], error: null }),
      categories: () => ({ data: [], error: null }),
    })

    const summary = await fetchSummaryData({
      client,
      period: 'daily',
      selectedDateStr,
      timeZone,
      now,
    })

    expect(summary.period).toBe('daily')
    expect(summary.dateStr).toBe(selectedDateStr)

    // Check that schedule overlap predicates were used: lt('start_at', endAt) and gt('end_at', startAt)
    const scheduleLt = calls.find(
      (c) => c.table === 'schedule_blocks' && c.method === 'lt' && c.args[0] === 'start_at'
    )
    const scheduleGt = calls.find(
      (c) => c.table === 'schedule_blocks' && c.method === 'gt' && c.args[0] === 'end_at'
    )
    expect(scheduleLt).toBeDefined()
    expect(scheduleGt).toBeDefined()
    expect(scheduleLt?.args[1]).toBe(summary.endAt)
    expect(scheduleGt?.args[1]).toBe(summary.startAt)
  })

  it('paginates results across pages when a query returns a full page of 500 items', async () => {
    // Generate 500 dummy task rows for page 1, and 10 rows for page 2
    const makeRow = (id: string) => ({
      id,
      user_id: 'user-1',
      category_id: null,
      parent_id: null,
      title: `Task ${id}`,
      description: null,
      status: 'todo',
      priority: 'medium',
      due_date_kind: 'date_time',
      due_at: '2026-10-10T02:00:00.000Z',
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-01T00:00:00.000Z',
    })

    const page1 = Array.from({ length: 500 }, (_, i) => makeRow(`p1-${i}`))
    const page2 = Array.from({ length: 10 }, (_, i) => makeRow(`p2-${i}`))

    let taskDueCallCount = 0
    const { client, calls } = createMockSupabase({
      tasks: () => {
        taskDueCallCount++
        if (taskDueCallCount === 1) {
          return { data: page1, error: null }
        }
        return { data: page2, error: null }
      },
      schedule_blocks: () => ({ data: [], error: null }),
      task_activities: () => ({ data: [], error: null }),
      categories: () => ({ data: [], error: null }),
    })

    const summary = await fetchSummaryData({
      client,
      period: 'daily',
      selectedDateStr,
      timeZone,
      now,
    })

    // Assert range calls were made for [0, 499] and [500, 999]
    const rangeCalls = calls.filter((c) => c.method === 'range')
    expect(rangeCalls.some((c) => c.args[0] === 0 && c.args[1] === 499)).toBe(true)
    expect(rangeCalls.some((c) => c.args[0] === 500 && c.args[1] === 999)).toBe(true)
    expect(summary.plannedCount).toBe(510)
  })

  it('resolves surviving activity task IDs not already present in due or completed tasks', async () => {
    const activityRow = {
      id: 'act-1',
      task_id: 'task-surviving-1',
      action: 'completed',
      created_at: '2026-10-10T02:00:00.000Z',
    }

    const survivingTaskRow = {
      id: 'task-surviving-1',
      user_id: 'user-1',
      category_id: null,
      parent_id: null,
      title: 'Reopened Task',
      description: null,
      status: 'todo', // currently reopened
      priority: 'medium',
      due_date_kind: 'date_time',
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-01T00:00:00.000Z',
    }

    let taskQueryCount = 0
    const { client, calls } = createMockSupabase({
      tasks: () => {
        taskQueryCount++
        // Query 1: tasksDue -> []
        // Query 2: tasksCompleted -> []
        // Query 3: incompleteCutoffTasks -> []
        // Query 4: .in('id', ['task-surviving-1']) -> [survivingTaskRow]
        if (taskQueryCount >= 4) {
          return { data: [survivingTaskRow], error: null }
        }
        return { data: [], error: null }
      },
      schedule_blocks: () => ({ data: [], error: null }),
      task_activities: () => ({ data: [activityRow], error: null }),
      categories: () => ({ data: [], error: null }),
    })

    const summary = await fetchSummaryData({
      client,
      period: 'daily',
      selectedDateStr,
      timeZone,
      now,
    })

    // Check that tasks table was queried with .in('id', ['task-surviving-1'])
    const inCall = calls.find((c) => c.table === 'tasks' && c.method === 'in')
    expect(inCall).toBeDefined()
    expect(inCall?.args[0]).toBe('id')
    expect(inCall?.args[1]).toEqual(['task-surviving-1'])
    expect(summary.completedCount).toBe(1)
    expect(summary.completedTasks[0].id).toBe('task-surviving-1')
  })

  it('throws an error and propagates database failures', async () => {
    const { client } = createMockSupabase({
      tasks: () => ({ data: null, error: { message: 'Database connection failed' } }),
      schedule_blocks: () => ({ data: [], error: null }),
      task_activities: () => ({ data: [], error: null }),
      categories: () => ({ data: [], error: null }),
    })

    await expect(
      fetchSummaryData({
        client,
        period: 'daily',
        selectedDateStr,
        timeZone,
        now,
      })
    ).rejects.toThrow('Database connection failed')
  })
})
