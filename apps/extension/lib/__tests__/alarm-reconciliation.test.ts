import { describe, it, expect } from 'vitest'
import { reconcileReminderAlarms } from '../alarm-reconciliation.js'
import type { ExistingAlarmSnapshot } from '../types.js'

describe('alarm-reconciliation', () => {
  const t1 = new Date('2026-10-06T10:00:00.000Z').getTime()
  const t2 = new Date('2026-10-06T12:00:00.000Z').getTime()
  const t3 = new Date('2026-10-06T14:00:00.000Z').getTime()

  it('1. unchanged: produces no operations when desired alarms match existing alarms', () => {
    const desired = [
      { id: 'rem-1', effectiveAt: new Date(t1).toISOString() },
    ]
    const existing: ExistingAlarmSnapshot[] = [
      { name: 'reminder:rem-1', scheduledTime: t1 },
    ]

    const result = reconcileReminderAlarms(desired, existing)

    expect(result.alarmsToCreate).toEqual([])
    expect(result.alarmsToRemove).toEqual([])
  })

  it('2. changed: represents changed timestamps as clear then create', () => {
    const desired = [
      { id: 'rem-1', effectiveAt: new Date(t2).toISOString() }, // changed from t1 to t2
    ]
    const existing: ExistingAlarmSnapshot[] = [
      { name: 'reminder:rem-1', scheduledTime: t1 },
    ]

    const result = reconcileReminderAlarms(desired, existing)

    expect(result.alarmsToRemove).toEqual(['reminder:rem-1'])
    expect(result.alarmsToCreate).toEqual([
      { name: 'reminder:rem-1', scheduledTime: t2 },
    ])
  })

  it('3. deleted: removes existing alarms when remote reminders are omitted or completed', () => {
    const desired: { id: string; effectiveAt: string }[] = []
    const existing: ExistingAlarmSnapshot[] = [
      { name: 'reminder:rem-1', scheduledTime: t1 },
      { name: 'reminder:rem-2', scheduledTime: t2 },
    ]

    const result = reconcileReminderAlarms(desired, existing)

    expect(result.alarmsToRemove).toEqual(['reminder:rem-1', 'reminder:rem-2'])
    expect(result.alarmsToCreate).toEqual([])
  })

  it('4. multiple reminders: handles a mix of unchanged, new, changed, and removed reminders', () => {
    const desired = [
      { id: 'rem-1', effectiveAt: new Date(t1).toISOString() }, // unchanged
      { id: 'rem-2', effectiveAt: new Date(t3).toISOString() }, // changed (was t2)
      { id: 'rem-3', effectiveAt: new Date(t3).toISOString() }, // new
    ]
    const existing: ExistingAlarmSnapshot[] = [
      { name: 'reminder:rem-1', scheduledTime: t1 }, // keep
      { name: 'reminder:rem-2', scheduledTime: t2 }, // change
      { name: 'reminder:rem-4', scheduledTime: t1 }, // remove
    ]

    const result = reconcileReminderAlarms(desired, existing)

    expect(result.alarmsToRemove).toEqual(['reminder:rem-2', 'reminder:rem-4'])
    expect(result.alarmsToCreate).toEqual([
      { name: 'reminder:rem-2', scheduledTime: t3 },
      { name: 'reminder:rem-3', scheduledTime: t3 },
    ])
  })

  it('5. unrelated alarms: completely ignores non-reminder alarms such as periodic sync', () => {
    const desired = [
      { id: 'rem-1', effectiveAt: new Date(t1).toISOString() },
    ]
    const existing: ExistingAlarmSnapshot[] = [
      { name: 'tabdo:sync:periodic', scheduledTime: 123456 },
      { name: 'other:custom-alarm', scheduledTime: 789012 },
    ]

    const result = reconcileReminderAlarms(desired, existing)

    // Unrelated alarms must NOT be in alarmsToRemove
    expect(result.alarmsToRemove).toEqual([])
    expect(result.alarmsToCreate).toEqual([
      { name: 'reminder:rem-1', scheduledTime: t1 },
    ])
  })
})
