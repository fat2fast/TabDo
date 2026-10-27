import { describe, expect, it } from 'vitest'
import { formatCompactOverdue } from '../utils/compact-overdue'

describe('compact overdue duration', () => {
  const due = '2026-01-01T00:00:00Z'
  it('shows elapsed days and hours without losing durations over a month', () => {
    expect(formatCompactOverdue(due, new Date('2026-01-01T00:30:00Z'))).toBe('Quá hạn: dưới 1 giờ')
    expect(formatCompactOverdue(due, new Date('2026-01-01T23:00:00Z'))).toBe('Quá hạn: 23 giờ')
    expect(formatCompactOverdue(due, new Date('2026-01-02T00:00:00Z'))).toBe('Quá hạn: 1 ngày')
    expect(formatCompactOverdue(due, new Date('2026-02-02T01:00:00Z'))).toBe('Quá hạn: 32 ngày 1 giờ')
    expect(formatCompactOverdue(due, new Date('2026-01-02T01:00:00Z'), 'en')).toBe('Overdue: 1 day 1 hour')
    expect(formatCompactOverdue('invalid')).toBe('')
  })
})
