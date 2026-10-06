import { describe, expect, it } from 'vitest'
import {
  fromScheduleInstant,
  getVisibleRangeForDay,
  getVisibleRangeForWeek,
  parseScheduleLocalDateTime,
} from '@tabdo/utils'

describe('schedule-datetime', () => {
  describe('Asia/Ho_Chi_Minh', () => {
    const tz = 'Asia/Ho_Chi_Minh'

    it('converts local date and time to UTC ISO instant without DST', () => {
      const res = parseScheduleLocalDateTime('2026-10-06', '09:00', tz)
      // UTC+7 -> 09:00 local is 02:00 UTC
      expect(res.instant).toBe('2026-10-06T02:00:00.000Z')
      expect(res.offsetString).toBe('+07:00')
      expect(res.isAmbiguous).toBe(false)
    })

    it('roundtrips instant back to local components', () => {
      const { dateStr, timeStr, offsetString } = fromScheduleInstant(
        '2026-10-06T02:00:00.000Z',
        tz
      )
      expect(dateStr).toBe('2026-10-06')
      expect(timeStr).toBe('09:00')
      expect(offsetString).toBe('+07:00')
    })

    it('handles a block crossing midnight correctly', () => {
      const start = parseScheduleLocalDateTime('2026-10-06', '23:30', tz)
      const end = parseScheduleLocalDateTime('2026-10-07', '01:00', tz)

      expect(start.instant).toBe('2026-10-06T16:30:00.000Z')
      expect(end.instant).toBe('2026-10-06T18:00:00.000Z')
      expect(new Date(end.instant).getTime()).toBeGreaterThan(new Date(start.instant).getTime())
    })
  })

  describe('UTC', () => {
    const tz = 'UTC'

    it('converts local UTC date and time to ISO instant directly', () => {
      const res = parseScheduleLocalDateTime('2026-10-06', '14:15', tz)
      expect(res.instant).toBe('2026-10-06T14:15:00.000Z')
      expect(res.offsetString).toBe('+00:00')
      expect(res.isAmbiguous).toBe(false)
    })

    it('roundtrips instant back to UTC components', () => {
      const { dateStr, timeStr, offsetString } = fromScheduleInstant(
        '2026-10-06T14:15:00.000Z',
        tz
      )
      expect(dateStr).toBe('2026-10-06')
      expect(timeStr).toBe('14:15')
      expect(offsetString).toBe('+00:00')
    })
  })

  describe('America/New_York DST transitions', () => {
    const tz = 'America/New_York'

    it('rejects spring-forward nonexistent wall time with descriptive error', () => {
      // Clocks jump 02:00 -> 03:00 on 2026-03-08 in America/New_York
      expect(() => {
        parseScheduleLocalDateTime('2026-03-08', '02:30', tz)
      }).toThrow(/Nonexistent local time/)
    })

    it('resolves fall-back repeated wall time to earlier occurrence and provides offset', () => {
      // Clocks fall back from 02:00 to 01:00 on 2026-11-01 in America/New_York
      // 01:30 occurs twice: first as EDT (UTC-4), then as EST (UTC-5)
      const res = parseScheduleLocalDateTime('2026-11-01', '01:30', tz)
      expect(res.isAmbiguous).toBe(true)
      // Earlier occurrence (EDT) is 05:30 UTC
      expect(res.instant).toBe('2026-11-01T05:30:00.000Z')
      expect(res.offsetString).toBe('-04:00')
    })
  })

  describe('Visible boundaries [start, end)', () => {
    it('generates [start, end) boundaries for a local day', () => {
      const tz = 'Asia/Ho_Chi_Minh'
      const range = getVisibleRangeForDay('2026-10-06', tz)

      // Start: 2026-10-06 00:00 local -> 2026-10-05 17:00 UTC
      expect(range.startAt).toBe('2026-10-05T17:00:00.000Z')
      // End: 2026-10-07 00:00 local -> 2026-10-06 17:00 UTC
      expect(range.endAt).toBe('2026-10-06T17:00:00.000Z')
    })

    it('generates [start, end) boundaries for a Monday-Sunday week', () => {
      const tz = 'Asia/Ho_Chi_Minh'
      // 2026-10-06 is Tuesday
      // Week Monday is 2026-10-05
      // Next Monday is 2026-10-12
      const range = getVisibleRangeForWeek('2026-10-06', tz)

      expect(range.startAt).toBe('2026-10-04T17:00:00.000Z')
      expect(range.endAt).toBe('2026-10-11T17:00:00.000Z')
    })
  })
})
