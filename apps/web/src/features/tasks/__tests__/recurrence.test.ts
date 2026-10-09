import { describe, expect, it } from 'vitest'
import {
  formatRecurrenceRuleSummary,
  calculateNextOccurrence,
  canonicalizeRecurrenceRule,
  isValidRecurrenceRule,
  parseRecurrenceRule,
  resetChecklistCompletionInDescription,
  resolveRecurrenceLocalDateTime,
  serializeRecurrenceRule,
} from '@tabdo/utils'

describe('Recurrence Contract & Utilities', () => {
  describe('Rule Validation & Canonical Round Trips', () => {
    it('accepts and canonicalizes daily, weekdays, weekly, and monthly', () => {
      expect(isValidRecurrenceRule('FREQ=DAILY')).toBe(true)
      expect(isValidRecurrenceRule('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')).toBe(true)
      expect(isValidRecurrenceRule('FREQ=WEEKLY')).toBe(true)
      expect(isValidRecurrenceRule('FREQ=MONTHLY')).toBe(true)

      expect(parseRecurrenceRule('FREQ=DAILY')).toEqual({ type: 'daily' })
      expect(parseRecurrenceRule('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')).toEqual({ type: 'weekdays' })
      expect(parseRecurrenceRule('FREQ=WEEKLY')).toEqual({ type: 'weekly' })
      expect(parseRecurrenceRule('FREQ=MONTHLY')).toEqual({ type: 'monthly' })

      expect(serializeRecurrenceRule({ type: 'daily' })).toBe('FREQ=DAILY')
      expect(serializeRecurrenceRule({ type: 'weekdays' })).toBe('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')
      expect(serializeRecurrenceRule({ type: 'weekly' })).toBe('FREQ=WEEKLY')
      expect(serializeRecurrenceRule({ type: 'monthly' })).toBe('FREQ=MONTHLY')
    })

    it('accepts and canonicalizes custom weekdays with unique sorted days', () => {
      expect(isValidRecurrenceRule('FREQ=WEEKLY;BYDAY=MO,WE,FR')).toBe(true)
      // Unsorted custom days should fail isValidRecurrenceRule because it is not canonical
      expect(isValidRecurrenceRule('FREQ=WEEKLY;BYDAY=FR,MO')).toBe(false)
      // Duplicates should fail
      expect(isValidRecurrenceRule('FREQ=WEEKLY;BYDAY=MO,MO,FR')).toBe(false)

      // parseRecurrenceRule normalizes day order
      const parsed = parseRecurrenceRule('FREQ=WEEKLY;BYDAY=FR,MO,WE')
      expect(parsed).toEqual({ type: 'custom', days: ['MO', 'WE', 'FR'] })
      expect(serializeRecurrenceRule(parsed!)).toBe('FREQ=WEEKLY;BYDAY=MO,WE,FR')

      // Normalizes 5 weekdays to weekdays
      const allWeekdays = parseRecurrenceRule('FREQ=WEEKLY;BYDAY=FR,TH,WE,TU,MO')
      expect(allWeekdays).toEqual({ type: 'weekdays' })
      expect(serializeRecurrenceRule(allWeekdays!)).toBe('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')
    })

    it('rejects arbitrary RRULE text and malformed strings', () => {
      expect(isValidRecurrenceRule('FREQ=YEARLY')).toBe(false)
      expect(isValidRecurrenceRule('FREQ=HOURLY')).toBe(false)
      expect(isValidRecurrenceRule('FREQ=MONTHLY;BYMONTHDAY=15')).toBe(false)
      expect(isValidRecurrenceRule('FREQ=WEEKLY;INTERVAL=2')).toBe(false)
      expect(isValidRecurrenceRule('RANDOM_TEXT')).toBe(false)
      expect(isValidRecurrenceRule('')).toBe(false)

      expect(parseRecurrenceRule('FREQ=YEARLY')).toBeNull()
      expect(() => canonicalizeRecurrenceRule('INVALID')).toThrow()
    })
  })

  describe('Deterministic Next Occurrence Calculations', () => {
    const tzHcm = 'Asia/Ho_Chi_Minh'
    const tzNy = 'America/New_York'

    it('calculates daily recurrence advancing 1 local day', () => {
      // 2026-10-05 09:00:00 ICT -> 2026-10-05 02:00:00 UTC
      const currentDue = '2026-10-05T02:00:00.000Z'
      const result = calculateNextOccurrence({
        dueAt: currentDue,
        dueDateKind: 'date_time',
        recurrenceRule: 'FREQ=DAILY',
        recurrenceTimezone: tzHcm,
      })

      // Next due should be 2026-10-06 09:00:00 ICT -> 2026-10-06 02:00:00 UTC
      expect(result.dueAt).toBe('2026-10-06T02:00:00.000Z')
      expect(result.dueDateKind).toBe('date_time')
      expect(result.recurrenceAnchorAt).toBe(currentDue)
    })

    it('calculates weekdays recurrence across Friday -> Monday', () => {
      // 2026-10-09 is Friday. 09:00 ICT -> 2026-10-09 02:00:00 UTC
      const fridayDue = '2026-10-09T02:00:00.000Z'
      const result = calculateNextOccurrence({
        dueAt: fridayDue,
        dueDateKind: 'date_time',
        recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
        recurrenceTimezone: tzHcm,
      })

      // Next occurrence must be Monday 2026-10-12 09:00 ICT -> 2026-10-12 02:00:00 UTC
      expect(result.dueAt).toBe('2026-10-12T02:00:00.000Z')
    })

    it('calculates custom weekdays recurrence (MO,WE,FR)', () => {
      // Monday 2026-10-05 -> Wednesday 2026-10-07
      const mondayDue = '2026-10-05T02:00:00.000Z'
      const next1 = calculateNextOccurrence({
        dueAt: mondayDue,
        dueDateKind: 'date_time',
        recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
        recurrenceTimezone: tzHcm,
      })
      expect(next1.dueAt).toBe('2026-10-07T02:00:00.000Z')

      // Wednesday 2026-10-07 -> Friday 2026-10-09
      const next2 = calculateNextOccurrence({
        dueAt: next1.dueAt,
        dueDateKind: 'date_time',
        recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
        recurrenceTimezone: tzHcm,
      })
      expect(next2.dueAt).toBe('2026-10-09T02:00:00.000Z')

      // Friday 2026-10-09 -> Monday 2026-10-12
      const next3 = calculateNextOccurrence({
        dueAt: next2.dueAt,
        dueDateKind: 'date_time',
        recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
        recurrenceTimezone: tzHcm,
      })
      expect(next3.dueAt).toBe('2026-10-12T02:00:00.000Z')
    })

    it('preserves monthly anchor day across month boundaries (Jan 31 -> Feb 28 -> Mar 31)', () => {
      // Jan 31, 2026 at 10:00 ICT -> 2026-01-31 03:00:00 UTC
      const jan31Due = '2026-01-31T03:00:00.000Z'
      const febResult = calculateNextOccurrence({
        dueAt: jan31Due,
        dueDateKind: 'date_time',
        recurrenceRule: 'FREQ=MONTHLY',
        recurrenceTimezone: tzHcm,
        recurrenceAnchorAt: jan31Due,
      })

      // Feb 2026 has 28 days -> Feb 28 10:00 ICT -> 2026-02-28 03:00:00 UTC
      expect(febResult.dueAt).toBe('2026-02-28T03:00:00.000Z')
      expect(febResult.recurrenceAnchorAt).toBe(jan31Due)

      // Now calculate next from Feb 28 using original anchor Jan 31
      const marResult = calculateNextOccurrence({
        dueAt: febResult.dueAt,
        dueDateKind: 'date_time',
        recurrenceRule: 'FREQ=MONTHLY',
        recurrenceTimezone: tzHcm,
        recurrenceAnchorAt: febResult.recurrenceAnchorAt,
      })

      // Mar 2026 has 31 days -> restored back to Mar 31 10:00 ICT -> 2026-03-31 03:00:00 UTC!
      expect(marResult.dueAt).toBe('2026-03-31T03:00:00.000Z')
    })

    it('handles leap year Feb 29 for monthly recurrence', () => {
      // Leap year 2028: Jan 31 10:00 ICT
      const jan31Leap = '2028-01-31T03:00:00.000Z'
      const febLeap = calculateNextOccurrence({
        dueAt: jan31Leap,
        dueDateKind: 'date_time',
        recurrenceRule: 'FREQ=MONTHLY',
        recurrenceTimezone: tzHcm,
        recurrenceAnchorAt: jan31Leap,
      })

      // Feb 2028 has 29 days -> Feb 29
      expect(febLeap.dueAt).toBe('2028-02-29T03:00:00.000Z')
    })

    it('retains date_only kind and maps to local end-of-day', () => {
      // Oct 5 date-only in ICT (23:59:59.999 ICT is 16:59:59.999 UTC)
      const dateOnlyDue = '2026-10-05T16:59:59.999Z'
      const result = calculateNextOccurrence({
        dueAt: dateOnlyDue,
        dueDateKind: 'date_only',
        recurrenceRule: 'FREQ=DAILY',
        recurrenceTimezone: tzHcm,
      })

      expect(result.dueDateKind).toBe('date_only')
      // Oct 6 23:59:59.999 ICT is Oct 6 16:59:59.999 UTC
      expect(result.dueAt).toBe('2026-10-06T16:59:59.999Z')
    })

    it('shifts startAt proportionally when present', () => {
      const currentDue = '2026-10-05T04:00:00.000Z'
      const currentStart = '2026-10-05T02:00:00.000Z' // 2 hours before due
      const result = calculateNextOccurrence({
        dueAt: currentDue,
        dueDateKind: 'date_time',
        recurrenceRule: 'FREQ=DAILY',
        recurrenceTimezone: tzHcm,
        startAt: currentStart,
      })

      expect(result.dueAt).toBe('2026-10-06T04:00:00.000Z')
      expect(result.startAt).toBe('2026-10-06T02:00:00.000Z')
    })

    it('resolves DST spring-forward gap to the first valid instant after gap', () => {
      // In America/New_York, 2026-03-08 springs forward: 02:00 -> 03:00 EDT
      // A daily task at 02:30:00 local time
      const resolved = resolveRecurrenceLocalDateTime('2026-03-08', '02:30:00', tzNy)
      // 03:00:00 EDT is 07:00:00 UTC
      expect(resolved.toISOString()).toBe('2026-03-08T07:00:00.000Z')
    })

    it('resolves DST fall-back fold to the earlier instant', () => {
      // In America/New_York, 2026-11-01 falls back: 01:00-02:00 repeats
      // 01:30:00 occurs first at UTC-4 (05:30:00 UTC), then at UTC-5 (06:30:00 UTC)
      const resolved = resolveRecurrenceLocalDateTime('2026-11-01', '01:30:00', tzNy)
      // Earlier candidate is 05:30:00 UTC
      expect(resolved.toISOString()).toBe('2026-11-01T05:30:00.000Z')
    })
  })

  describe('Checklist Description Reset Helper', () => {
    it('resets embedded checklist item completion flags while preserving text, attachments, and links', () => {
      const desc = [
        'Chuẩn bị báo cáo tài chính hàng tháng.',
        '<!-- tabdo_checklist: [{"id":"chk-1","text":"Thu thập số liệu","completed":true},{"id":"chk-2","text":"Soát lỗi kế toán","completed":true},{"id":"chk-3","text":"Trình ký","completed":false}] -->',
        '<!-- tabdo_linked: ["task-123","task-456"] -->',
        '<!-- tabdo_attachments: [{"id":"att-1","name":"report.pdf","url":"https://example.com/report.pdf"}] -->',
      ].join('\n\n')

      const reset = resetChecklistCompletionInDescription(desc)

      expect(reset).toContain('"id":"chk-1","text":"Thu thập số liệu","completed":false')
      expect(reset).toContain('"id":"chk-2","text":"Soát lỗi kế toán","completed":false')
      expect(reset).toContain('"id":"chk-3","text":"Trình ký","completed":false')

      expect(reset).toContain('<!-- tabdo_linked: ["task-123","task-456"] -->')
      expect(reset).toContain('<!-- tabdo_attachments: [{"id":"att-1","name":"report.pdf","url":"https://example.com/report.pdf"}] -->')
      expect(reset).toContain('Chuẩn bị báo cáo tài chính hàng tháng.')
    })

    it('resets legacy markdown checklists (- [x] -> - [ ])', () => {
      const legacyDesc = [
        'Mô tả công việc',
        '- [ ] Việc 1',
        '- [x] Việc 2 đã xong',
        '  - [X] Việc phụ 2.1',
      ].join('\n')

      const reset = resetChecklistCompletionInDescription(legacyDesc)
      expect(reset).toBe([
        'Mô tả công việc',
        '- [ ] Việc 1',
        '- [ ] Việc 2 đã xong',
        '  - [ ] Việc phụ 2.1',
      ].join('\n'))
    })

    it('returns null or undefined as-is', () => {
      expect(resetChecklistCompletionInDescription(null)).toBeNull()
      expect(resetChecklistCompletionInDescription(undefined)).toBeUndefined()
      expect(resetChecklistCompletionInDescription('')).toBe('')
    })
  })

  describe('formatRecurrenceRuleSummary', () => {
    it('returns compact Vietnamese summaries for standard recurrence rules', () => {
      expect(formatRecurrenceRuleSummary('FREQ=DAILY')).toBe('Hàng ngày')
      expect(formatRecurrenceRuleSummary('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')).toBe('T2 - T6')
      expect(formatRecurrenceRuleSummary('FREQ=WEEKLY')).toBe('Hàng tuần')
      expect(formatRecurrenceRuleSummary('FREQ=MONTHLY')).toBe('Hàng tháng')
      expect(formatRecurrenceRuleSummary('FREQ=WEEKLY;BYDAY=MO,WE,FR')).toBe('T2, T4, T6')
    })

    it('returns null for null, empty or invalid rules', () => {
      expect(formatRecurrenceRuleSummary(null)).toBeNull()
      expect(formatRecurrenceRuleSummary(undefined)).toBeNull()
      expect(formatRecurrenceRuleSummary('')).toBeNull()
      expect(formatRecurrenceRuleSummary('INVALID')).toBeNull()
    })
  })
})
