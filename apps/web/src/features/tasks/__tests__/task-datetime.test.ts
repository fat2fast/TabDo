import { describe, expect, it } from 'vitest'
import {
  getLocalDayBoundaries,
  getTomorrowBoundaries,
  getThisWeekEnd,
  toDateOnlyEndOfDay,
  isTaskOverdue,
  formatTaskDueDate,
  formatTaskExecutionDuration,
  formatTaskOverdueDuration,
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

  it('formats task execution duration supporting months, days, hours, and minutes', () => {
    // 1 month, 5 days, 2 hours, 30 minutes
    const created = '2026-08-01T10:00:00.000Z'
    const completed = '2026-09-06T12:30:00.000Z'
    expect(formatTaskExecutionDuration(created, completed, 'vi')).toBe(
      '1 tháng 5 ngày 2 giờ 30 phút'
    )
    expect(formatTaskExecutionDuration(created, completed, 'en')).toBe(
      '1 month 5 days 2 hours 30 mins'
    )

    // Just hours and minutes
    const created2 = '2026-10-10T08:00:00.000Z'
    const completed2 = '2026-10-10T12:15:00.000Z'
    expect(formatTaskExecutionDuration(created2, completed2, 'vi')).toBe(
      '4 giờ 15 phút'
    )
    expect(formatTaskExecutionDuration(created2, completed2, 'en')).toBe(
      '4 hours 15 mins'
    )

    // Under 1 minute
    const created3 = '2026-10-10T10:00:00.000Z'
    const completed3 = '2026-10-10T10:00:20.000Z'
    expect(formatTaskExecutionDuration(created3, completed3, 'vi')).toBe('Dưới 1 phút')
    expect(formatTaskExecutionDuration(created3, completed3, 'en')).toBe('Less than 1 minute')

    // Invalid / negative duration fallback
    const invalidCompleted = '2026-10-09T10:00:00.000Z'
    expect(formatTaskExecutionDuration(created3, invalidCompleted, 'vi')).toBe('Dưới 1 phút')
  })

  it('formats task due date cleanly without prefix to prevent wrapping', () => {
    const tz = 'Asia/Ho_Chi_Minh'
    const dueAt = '2026-10-09T16:59:59.999Z' // 23:59:59 ICT on 2026-10-09
    expect(formatTaskDueDate(dueAt, 'date_only', tz)).toBe('09/10/2026')
    expect(formatTaskDueDate(dueAt, 'date_time', tz)).toBe('09/10/2026 23:59')
  })

  it('formats task overdue duration supporting months, days, hours, and minutes', () => {
    // 1 month 2 days 5 hours 30 minutes overdue
    const dueAt = '2026-08-01T10:00:00.000Z'
    const now = new Date('2026-09-03T15:30:00.000Z')
    expect(formatTaskOverdueDuration(dueAt, now, 'vi')).toBe(
      'Quá hạn: 1 tháng 2 ngày 5 giờ 30 phút'
    )
    expect(formatTaskOverdueDuration(dueAt, now, 'en')).toBe(
      'Overdue: 1 month 2 days 5 hours 30 mins'
    )

    // Overdue by 16 hours
    const dueAt2 = '2026-10-09T17:00:00.000Z'
    const now2 = new Date('2026-10-10T09:00:00.000Z')
    expect(formatTaskOverdueDuration(dueAt2, now2, 'vi')).toBe('Quá hạn: 16 giờ')
    expect(formatTaskOverdueDuration(dueAt2, now2, 'en')).toBe('Overdue: 16 hours')

    // Under 1 minute overdue
    const dueAt3 = '2026-10-10T10:00:00.000Z'
    const now3 = new Date('2026-10-10T10:00:30.000Z')
    expect(formatTaskOverdueDuration(dueAt3, now3, 'vi')).toBe('Quá hạn: Dưới 1 phút')
    expect(formatTaskOverdueDuration(dueAt3, now3, 'en')).toBe('Overdue: Less than 1 minute')

    // Not overdue (future date) returns empty string
    const futureDue = '2026-10-11T10:00:00.000Z'
    expect(formatTaskOverdueDuration(futureDue, now3, 'vi')).toBe('')
  })
})
