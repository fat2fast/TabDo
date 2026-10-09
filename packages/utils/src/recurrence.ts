import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import type {
  DueDateKind,
  RecurrenceConfig,
  RecurrenceType,
  RecurrenceWeekday,
} from '@tabdo/types'
import { toDateOnlyEndOfDay } from './task-datetime.js'

export const ORDERED_WEEKDAYS: RecurrenceWeekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

const WEEKDAY_TO_DAY_OF_WEEK: Record<RecurrenceWeekday, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
}

const DAY_OF_WEEK_TO_WEEKDAY: Record<number, RecurrenceWeekday> = {
  0: 'SU',
  1: 'MO',
  2: 'TU',
  3: 'WE',
  4: 'TH',
  5: 'FR',
  6: 'SA',
}

/**
 * Validates whether a recurrence rule string strictly matches the supported canonical allowlist:
 * - FREQ=DAILY
 * - FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR (weekdays)
 * - FREQ=WEEKLY
 * - FREQ=MONTHLY
 * - FREQ=WEEKLY;BYDAY=<sorted, unique subset of MO,TU,WE,TH,FR,SA,SU>
 */
export function isValidRecurrenceRule(ruleStr: string): boolean {
  if (!ruleStr || typeof ruleStr !== 'string') return false
  const trimmed = ruleStr.trim()
  if (trimmed === 'FREQ=DAILY') return true
  if (trimmed === 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR') return true
  if (trimmed === 'FREQ=WEEKLY') return true
  if (trimmed === 'FREQ=MONTHLY') return true

  const customMatch = /^FREQ=WEEKLY;BYDAY=([A-Z,]+)$/.exec(trimmed)
  if (!customMatch || !customMatch[1]) return false

  const days = customMatch[1].split(',')
  if (days.length === 0 || days.length > 7) return false

  // Must be unique valid weekdays in strictly sorted order
  let lastIndex = -1
  for (const day of days) {
    const idx = ORDERED_WEEKDAYS.indexOf(day as RecurrenceWeekday)
    if (idx === -1) return false
    if (idx <= lastIndex) return false // not strictly ascending (handles duplicates and unsorted)
    lastIndex = idx
  }

  return true
}

/**
 * Parses a recurrence rule string into a typed RecurrenceConfig.
 * Returns null if string is null/undefined or invalid.
 */
export function parseRecurrenceRule(ruleStr: string | null | undefined): RecurrenceConfig | null {
  if (!ruleStr || !ruleStr.trim()) return null
  const trimmed = ruleStr.trim()
  if (trimmed === 'FREQ=DAILY') return { type: 'daily' }
  if (trimmed === 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR') return { type: 'weekdays' }
  if (trimmed === 'FREQ=WEEKLY') return { type: 'weekly' }
  if (trimmed === 'FREQ=MONTHLY') return { type: 'monthly' }

  const customMatch = /^FREQ=WEEKLY;BYDAY=([A-Z,]+)$/.exec(trimmed)
  if (!customMatch || !customMatch[1]) return null

  const daysRaw = customMatch[1].split(',')
  const validDays: RecurrenceWeekday[] = []
  for (const day of daysRaw) {
    if (ORDERED_WEEKDAYS.includes(day as RecurrenceWeekday) && !validDays.includes(day as RecurrenceWeekday)) {
      validDays.push(day as RecurrenceWeekday)
    } else {
      return null
    }
  }

  if (validDays.length === 0) return null

  // Sort canonical
  validDays.sort((a, b) => ORDERED_WEEKDAYS.indexOf(a) - ORDERED_WEEKDAYS.indexOf(b))

  if (
    validDays.length === 5 &&
    validDays.every((d, i) => d === ['MO', 'TU', 'WE', 'TH', 'FR'][i])
  ) {
    return { type: 'weekdays' }
  }

  return { type: 'custom', days: validDays }
}

/**
 * Serializes a typed RecurrenceConfig into its canonical serialized RRULE string.
 */
export function serializeRecurrenceRule(config: RecurrenceConfig): string | null {
  if (config.type === 'none') return null
  if (config.type === 'daily') return 'FREQ=DAILY'
  if (config.type === 'weekdays') return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
  if (config.type === 'weekly') return 'FREQ=WEEKLY'
  if (config.type === 'monthly') return 'FREQ=MONTHLY'
  if (config.type === 'custom') {
    if (!config.days || config.days.length === 0) {
      throw new Error('Custom recurrence rule requires at least one weekday')
    }
    const uniqueDays = Array.from(new Set(config.days))
    uniqueDays.sort((a, b) => ORDERED_WEEKDAYS.indexOf(a) - ORDERED_WEEKDAYS.indexOf(b))
    if (
      uniqueDays.length === 5 &&
      uniqueDays.every((d, i) => d === ['MO', 'TU', 'WE', 'TH', 'FR'][i])
    ) {
      return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
    }
    return `FREQ=WEEKLY;BYDAY=${uniqueDays.join(',')}`
  }
  return null
}

/**
 * Canonicalizes a recurrence rule string. Throws error if invalid.
 */
export function canonicalizeRecurrenceRule(ruleStr: string | null | undefined): string | null {
  if (!ruleStr) return null
  const parsed = parseRecurrenceRule(ruleStr)
  if (!parsed) {
    throw new Error(`Invalid or unsupported recurrence rule: '${ruleStr}'`)
  }
  return serializeRecurrenceRule(parsed)
}

/**
 * Recurrence-specific local datetime resolver.
 * - Gap (spring-forward nonexistent time): moves to first valid local instant after gap.
 * - Fold (fall-back ambiguous time): selects the earlier instant.
 */
export function resolveRecurrenceLocalDateTime(
  dateStr: string,
  timeStr: string,
  timeZone: string
): Date {
  const normalizedTime = timeStr.trim().length === 5 ? `${timeStr.trim()}:00` : timeStr.trim()
  const wallClock = `${dateStr}T${normalizedTime}`
  const initialDate = fromZonedTime(wallClock, timeZone)
  const expectedWall = `${dateStr}T${normalizedTime.slice(0, 5)}`
  const roundTripWall = formatInTimeZone(initialDate, timeZone, "yyyy-MM-dd'T'HH:mm")

  // Check fall-back fold (earlier candidate has identical local wall-clock representation)
  const earlierCandidate = new Date(initialDate.getTime() - 3600000)
  if (formatInTimeZone(earlierCandidate, timeZone, "yyyy-MM-dd'T'HH:mm") === expectedWall) {
    return earlierCandidate
  }

  // Check spring-forward gap (time skipped ahead, nonexistent on clock)
  if (roundTripWall !== expectedWall) {
    const [hStr, mStr] = normalizedTime.split(':')
    const totalMinutes = Number(hStr) * 60 + Number(mStr)
    // Scan ahead minute by minute up to 3 hours to find the first valid instant
    for (let step = 1; step <= 180; step++) {
      const curTotal = totalMinutes + step
      const hh = String(Math.floor(curTotal / 60)).padStart(2, '0')
      const mm = String(curTotal % 60).padStart(2, '0')
      const testWall = `${dateStr}T${hh}:${mm}:00`
      const candidate = fromZonedTime(testWall, timeZone)
      if (formatInTimeZone(candidate, timeZone, "yyyy-MM-dd'T'HH:mm") === `${dateStr}T${hh}:${mm}`) {
        return candidate
      }
    }
  }

  return initialDate
}

export interface CalculateNextOccurrenceInput {
  dueAt: string
  dueDateKind: DueDateKind
  recurrenceRule: string
  recurrenceTimezone: string
  recurrenceAnchorAt?: string | null
  startAt?: string | null
}

export interface CalculateNextOccurrenceResult {
  dueAt: string
  dueDateKind: DueDateKind
  startAt: string | null
  recurrenceAnchorAt: string
}

/**
 * Calculates the next occurrence deterministically against the stored recurrence timezone.
 */
export function calculateNextOccurrence(
  input: CalculateNextOccurrenceInput
): CalculateNextOccurrenceResult {
  const {
    dueAt,
    dueDateKind,
    recurrenceRule,
    recurrenceTimezone,
    recurrenceAnchorAt,
    startAt,
  } = input

  const config = parseRecurrenceRule(recurrenceRule)
  if (!config || config.type === 'none') {
    throw new Error(`Cannot calculate next occurrence for non-recurring rule: '${recurrenceRule}'`)
  }

  const currentDueDate = new Date(dueAt)
  const anchorInstant = recurrenceAnchorAt || dueAt
  const anchorDate = new Date(anchorInstant)

  // Determine local date parts in recurrenceTimezone
  const currentYear = Number(formatInTimeZone(currentDueDate, recurrenceTimezone, 'yyyy'))
  const currentMonth = Number(formatInTimeZone(currentDueDate, recurrenceTimezone, 'M')) // 1..12
  const currentDay = Number(formatInTimeZone(currentDueDate, recurrenceTimezone, 'd')) // 1..31
  const currentDayOfWeek = Number(formatInTimeZone(currentDueDate, recurrenceTimezone, 'i')) % 7 // 1=MO..7=SU -> 0=SU..6=SA

  let nextYear = currentYear
  let nextMonth = currentMonth
  let nextDay = currentDay

  let daysToAdd = 0
  if (config.type === 'daily') {
    daysToAdd = 1
  } else if (config.type === 'weekdays') {
    // Weekdays MO..FR. Friday (5) -> Monday (+3), Sat (6) -> Mon (+2), Sun (0) -> Mon (+1), else +1
    if (currentDayOfWeek === 5) daysToAdd = 3
    else if (currentDayOfWeek === 6) daysToAdd = 2
    else if (currentDayOfWeek === 0) daysToAdd = 1
    else daysToAdd = 1
  } else if (config.type === 'weekly') {
    // Same weekday next week: +7 days
    daysToAdd = 7
  } else if (config.type === 'custom') {
    const allowedDays = config.days || []
    const allowedDayNums = allowedDays.map((d) => WEEKDAY_TO_DAY_OF_WEEK[d])

    daysToAdd = 1
    for (let step = 1; step <= 7; step++) {
      const checkDayOfWeek = (currentDayOfWeek + step) % 7
      if (allowedDayNums.includes(checkDayOfWeek)) {
        daysToAdd = step
        break
      }
    }
  } else if (config.type === 'monthly') {
    // Monthly: advance month by 1, preserving original anchor day
    const anchorDay = Number(formatInTimeZone(anchorDate, recurrenceTimezone, 'd'))
    if (currentMonth === 12) {
      nextYear = currentYear + 1
      nextMonth = 1
    } else {
      nextYear = currentYear
      nextMonth = currentMonth + 1
    }

    // Number of days in nextMonth
    const daysInNextMonth = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate()
    nextDay = Math.min(anchorDay, daysInNextMonth)
  }

  if (daysToAdd > 0) {
    const nextDate = new Date(Date.UTC(currentYear, currentMonth - 1, currentDay + daysToAdd))
    nextYear = nextDate.getUTCFullYear()
    nextMonth = nextDate.getUTCMonth() + 1
    nextDay = nextDate.getUTCDate()
  }

  const nextDateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`

  let nextDueAtInstant: string
  if (dueDateKind === 'date_only') {
    nextDueAtInstant = toDateOnlyEndOfDay(nextDateStr, recurrenceTimezone).toISOString()
  } else {
    const timeStr = formatInTimeZone(currentDueDate, recurrenceTimezone, 'HH:mm:ss')
    const resolvedDate = resolveRecurrenceLocalDateTime(nextDateStr, timeStr, recurrenceTimezone)
    nextDueAtInstant = resolvedDate.toISOString()
  }

  // Calculate startAt shift if startAt is present
  let nextStartAt: string | null = null
  if (startAt) {
    const diffMs = currentDueDate.getTime() - new Date(startAt).getTime()
    const nextStartDate = new Date(new Date(nextDueAtInstant).getTime() - diffMs)
    nextStartAt = nextStartDate.toISOString()
  }

  return {
    dueAt: nextDueAtInstant,
    dueDateKind,
    startAt: nextStartAt,
    recurrenceAnchorAt: anchorInstant,
  }
}

const CHECKLIST_TAG_REGEX = /<!--\s*tabdo_checklist:\s*(\[[\s\S]*?\])\s*-->/i

/**
 * Pure description-metadata helper that resets embedded checklist completion flags
 * while preserving checklist text, attachments, and linked-task IDs.
 */
export function resetChecklistCompletionInDescription(
  description: string | null | undefined
): string | null | undefined {
  if (!description) return description

  let result = description

  // 1. Reset JSON checklist metadata comment
  const match = CHECKLIST_TAG_REGEX.exec(result)
  if (match && match[1]) {
    try {
      const items = JSON.parse(match[1])
      if (Array.isArray(items)) {
        const resetItems = items.map((item) =>
          item && typeof item === 'object' ? { ...item, completed: false } : item
        )
        const newTag = `<!-- tabdo_checklist: ${JSON.stringify(resetItems)} -->`
        result = result.replace(CHECKLIST_TAG_REGEX, newTag)
      }
    } catch {
      // Ignore parse errors
    }
  }

  // 2. Reset legacy markdown checkboxes (- [x] / - [X] -> - [ ])
  // Split lines and replace checkboxes without altering attachments or links
  const lines = result.split('\n')
  const updatedLines = lines.map((line) => {
    const trimmed = line.trimStart()
    if (trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')) {
      const leadingSpaces = line.slice(0, line.length - trimmed.length)
      return `${leadingSpaces}- [ ] ${trimmed.slice(6)}`
    }
    return line
  })

  return updatedLines.join('\n')
}

/**
 * Formats a canonical recurrence rule into a compact, human-readable localized Vietnamese label.
 * Returns null if the rule is absent or type is 'none'.
 */
export function formatRecurrenceRuleSummary(ruleStr: string | null | undefined): string | null {
  const config = parseRecurrenceRule(ruleStr)
  if (!config || config.type === 'none') return null
  switch (config.type) {
    case 'daily':
      return 'Hàng ngày'
    case 'weekdays':
      return 'T2 - T6'
    case 'weekly':
      return 'Hàng tuần'
    case 'monthly':
      return 'Hàng tháng'
    case 'custom': {
      if (!config.days || config.days.length === 0) return 'Tùy chỉnh'
      const viDayLabels: Record<RecurrenceWeekday, string> = {
        MO: 'T2',
        TU: 'T3',
        WE: 'T4',
        TH: 'T5',
        FR: 'T6',
        SA: 'T7',
        SU: 'CN',
      }
      return config.days.map((d) => viDayLabels[d] || d).join(', ')
    }
    default:
      return null
  }
}
