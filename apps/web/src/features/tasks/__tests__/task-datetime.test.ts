import { describe, expect, it } from 'vitest'
import {
  getLocalDayBoundaries,
  getTomorrowBoundaries,
  getThisWeekEnd,
  toDateOnlyEndOfDay,
  isTaskOverdue,
} from '@tabdo/utils'

describe('task-datetime timezone utilities', () => {
  it('calculates correct local day boundaries for Asia/Ho_Chi_Minh (UTC+7)', () => {
    // 2026-10-05 at 12:00:00 UTC is 19:00:00 in Asia/Ho_Chi_Minh
    const now = new Date('2026-10-05T12:00:00.000Z')
    const tz = 'Asia/Ho_Chi_Minh'

    const { startOfDay, endOfDay } = getLocalDayBoundaries(now, tz)

    // Local start of day 2026-10-05 00:00:00 is 2026-10-04 17:00:00 UTC
    expect(startOfDay.toISOString()).toBe('2026-10-04T17:00:00.000Z')
    // Local end of day 2026-10-05 23:59:59.999 is 2026-10-05 16:59:59.999 UTC
    expect(endOfDay.toISOString()).toBe('2026-10-05T16:59:59.999Z')
  })

  it('calculates correct local day boundaries across DST in America/New_York', () => {
    // In July (EDT, UTC-4): 2026-07-15 at 15:00:00 UTC is 11:00:00 EDT
    const summerNow = new Date('2026-07-15T15:00:00.000Z')
    const tz = 'America/New_York'

    const summerBoundaries = getLocalDayBoundaries(summerNow, tz)
    // 00:00 EDT is 04:00 UTC
    expect(summerBoundaries.startOfDay.toISOString()).toBe('2026-07-15T04:00:00.000Z')
    // 23:59:59.999 EDT is 03:59:59.999 UTC of next day
    expect(summerBoundaries.endOfDay.toISOString()).toBe('2026-07-16T03:59:59.999Z')

    // In December (EST, UTC-5): 2026-12-15 at 15:00:00 UTC is 10:00:00 EST
    const winterNow = new Date('2026-12-15T15:00:00.000Z')
    const winterBoundaries = getLocalDayBoundaries(winterNow, tz)
    // 00:00 EST is 05:00 UTC
    expect(winterBoundaries.startOfDay.toISOString()).toBe('2026-12-15T05:00:00.000Z')
    expect(winterBoundaries.endOfDay.toISOString()).toBe('2026-12-16T04:59:59.999Z')
  })

  it('calculates tomorrow boundaries correctly', () => {
    const now = new Date('2026-10-05T10:00:00.000Z') // 17:00 ICT on Oct 5
    const tz = 'Asia/Ho_Chi_Minh'

    const { startOfTomorrow, endOfTomorrow } = getTomorrowBoundaries(now, tz)

    // Tomorrow is Oct 6 in ICT: starts 2026-10-05T17:00:00.000Z, ends 2026-10-06T16:59:59.999Z
    expect(startOfTomorrow.toISOString()).toBe('2026-10-05T17:00:00.000Z')
    expect(endOfTomorrow.toISOString()).toBe('2026-10-06T16:59:59.999Z')
  })

  it('calculates Sunday end of week based on Monday-Sunday convention', () => {
    // 2026-10-05 is a Monday.
    // Sunday of that week is 2026-10-11 in ICT.
    const monday = new Date('2026-10-05T03:00:00.000Z')
    const tz = 'Asia/Ho_Chi_Minh'

    const endOfWeek = getThisWeekEnd(monday, tz)
    // Sunday 2026-10-11 23:59:59.999 ICT is 2026-10-11 16:59:59.999 UTC
    expect(endOfWeek.toISOString()).toBe('2026-10-11T16:59:59.999Z')
  })

  it('converts date-only input to local end-of-day UTC instant without UTC-string drift', () => {
    const tz = 'Asia/Ho_Chi_Minh'
    const endOfDay = toDateOnlyEndOfDay('2026-10-15', tz)

    // 2026-10-15 23:59:59.999 ICT is 2026-10-15 16:59:59.999 UTC
    expect(endOfDay.toISOString()).toBe('2026-10-15T16:59:59.999Z')
  })

  it('evaluates task overdue status deterministically without calling Date.now', () => {
    const referenceNow = new Date('2026-10-05T12:00:00.000Z')

    // Due 1 second before now -> overdue
    const pastDue = '2026-10-05T11:59:59.000Z'
    expect(isTaskOverdue(pastDue, 'todo', referenceNow)).toBe(true)
    expect(isTaskOverdue(pastDue, 'in_progress', referenceNow)).toBe(true)

    // Status 'done' is NEVER overdue
    expect(isTaskOverdue(pastDue, 'done', referenceNow)).toBe(false)

    // Due 1 second after now -> not overdue
    const futureDue = '2026-10-05T12:00:01.000Z'
    expect(isTaskOverdue(futureDue, 'todo', referenceNow)).toBe(false)

    // Null or undefined due date -> not overdue
    expect(isTaskOverdue(null, 'todo', referenceNow)).toBe(false)
    expect(isTaskOverdue(undefined, 'todo', referenceNow)).toBe(false)
  })
})
