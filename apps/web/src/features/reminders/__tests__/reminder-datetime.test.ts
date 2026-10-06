import { describe, expect, it } from 'vitest'
import {
  deriveAlarmName,
  deriveCacheNamespace,
  formatReminderDisplay,
  resolveRelativeReminderInstant,
  resolveSnoozeInstant,
} from '@tabdo/utils'

describe('reminder-datetime', () => {
  it('derives relative reminder instant from dueAt and offsetMinutes', () => {
    const dueAt = '2026-10-06T12:00:00.000Z'

    // At due time (0 offset)
    expect(resolveRelativeReminderInstant(dueAt, 0)).toBe('2026-10-06T12:00:00.000Z')

    // 15 minutes before
    expect(resolveRelativeReminderInstant(dueAt, 15)).toBe('2026-10-06T11:45:00.000Z')

    // 1 hour (60 minutes) before
    expect(resolveRelativeReminderInstant(dueAt, 60)).toBe('2026-10-06T11:00:00.000Z')

    // 1 day (1440 minutes) before
    expect(resolveRelativeReminderInstant(dueAt, 1440)).toBe('2026-10-05T12:00:00.000Z')
  })

  it('derives snooze instant correctly', () => {
    const now = new Date('2026-10-06T10:00:00.000Z')
    // 15 minutes snooze
    expect(resolveSnoozeInstant(now, 15)).toBe('2026-10-06T10:15:00.000Z')
    // 30 minutes snooze
    expect(resolveSnoozeInstant(now, 30)).toBe('2026-10-06T10:30:00.000Z')
  })

  it('derives stable alarm name format: reminder:<id>', () => {
    expect(deriveAlarmName('rem-12345')).toBe('reminder:rem-12345')
  })

  it('derives isolated cache namespace by schema version and userId', () => {
    expect(deriveCacheNamespace('user-abc', 1)).toBe('tabdo:reminders:v1:user-abc')
    expect(deriveCacheNamespace('user-xyz', 2)).toBe('tabdo:reminders:v2:user-xyz')
  })

  it('formats reminder display in profile timezone', () => {
    const instant = '2026-10-06T02:30:00.000Z'
    // UTC+7 -> 09:30
    expect(formatReminderDisplay(instant, 'Asia/Ho_Chi_Minh')).toBe('06/10/2026 09:30')
    // UTC
    expect(formatReminderDisplay(instant, 'UTC')).toBe('06/10/2026 02:30')
  })
})
