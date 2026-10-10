import { describe, expect, it } from 'vitest'
import {
  getSummaryRangeForDay,
  getSummaryRangeForWeek,
  parseLocalDateReference,
} from '@tabdo/utils'

describe('Summary Date and Range Helpers', () => {
  it('parses local date without falling victim to UTC midnight shift', () => {
    // In UTC-4 / UTC-5, JS new Date('2026-10-10') would be Oct 9 evening in New York.
    // parseLocalDateReference uses local noon so it always stays on the calendar date.
    const refNY = parseLocalDateReference('2026-10-10', 'America/New_York')
    expect(refNY.toISOString()).toBe('2026-10-10T16:00:00.000Z') // 12:00 EDT = 16:00 UTC

    const refVN = parseLocalDateReference('2026-10-10', 'Asia/Ho_Chi_Minh')
    expect(refVN.toISOString()).toBe('2026-10-10T05:00:00.000Z') // 12:00 ICT = 05:00 UTC
  })

  it('throws on invalid local date format', () => {
    expect(() => parseLocalDateReference('invalid', 'Asia/Ho_Chi_Minh')).toThrow()
    expect(() => parseLocalDateReference('10/10/2026', 'Asia/Ho_Chi_Minh')).toThrow()
  })

  it('calculates daily [start, end) range in Asia/Ho_Chi_Minh (UTC+7)', () => {
    const range = getSummaryRangeForDay('2026-10-10', 'Asia/Ho_Chi_Minh')
    expect(range.startAt).toBe('2026-10-09T17:00:00.000Z')
    expect(range.endAt).toBe('2026-10-10T17:00:00.000Z')
  })

  it('calculates weekly Monday 00:00 to next Monday 00:00 range in Asia/Ho_Chi_Minh', () => {
    // 2026-10-10 is Saturday. Monday is 2026-10-05, next Monday is 2026-10-12.
    const range = getSummaryRangeForWeek('2026-10-10', 'Asia/Ho_Chi_Minh')
    expect(range.startAt).toBe('2026-10-04T17:00:00.000Z') // 2026-10-05 00:00 ICT
    expect(range.endAt).toBe('2026-10-11T17:00:00.000Z') // 2026-10-12 00:00 ICT
  })

  it('handles DST spring-forward 23h day in America/New_York', () => {
    // 2026-03-08 is spring forward in the US.
    const dayRange = getSummaryRangeForDay('2026-03-08', 'America/New_York')
    expect(dayRange.startAt).toBe('2026-03-08T05:00:00.000Z') // 00:00 EST
    expect(dayRange.endAt).toBe('2026-03-09T04:00:00.000Z') // 00:00 EDT (next day)

    // The duration is exactly 23 hours
    const durationHours =
      (new Date(dayRange.endAt).getTime() - new Date(dayRange.startAt).getTime()) /
      (1000 * 60 * 60)
    expect(durationHours).toBe(23)
  })

  it('handles DST transition week correctly in America/New_York', () => {
    // Week of 2026-03-08: Monday 2026-03-02 00:00 EST to Monday 2026-03-09 00:00 EDT
    const weekRange = getSummaryRangeForWeek('2026-03-08', 'America/New_York')
    expect(weekRange.startAt).toBe('2026-03-02T05:00:00.000Z')
    expect(weekRange.endAt).toBe('2026-03-09T04:00:00.000Z')
  })
})
