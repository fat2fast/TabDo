import { addDays, endOfDay, endOfWeek, isBefore, nextMonday, nextSaturday, startOfDay, startOfWeek } from 'date-fns'
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz'
import type { DueDateKind } from '@tabdo/types'

/**
 * Returns the start (00:00:00.000) and end (23:59:59.999) of the local day
 * corresponding to the reference instant `now` in the given `timeZone`.
 * Both returned Dates are UTC instants.
 */
export function getLocalDayBoundaries(
  now: Date,
  timeZone: string
): { startOfDay: Date; endOfDay: Date } {
  const zonedNow = toZonedTime(now, timeZone)
  const zonedStart = startOfDay(zonedNow)
  const zonedEnd = endOfDay(zonedNow)

  return {
    startOfDay: fromZonedTime(zonedStart, timeZone),
    endOfDay: fromZonedTime(zonedEnd, timeZone),
  }
}

/**
 * Returns the start and end of tomorrow for the given reference instant `now` in `timeZone`.
 */
export function getTomorrowBoundaries(
  now: Date,
  timeZone: string
): { startOfTomorrow: Date; endOfTomorrow: Date } {
  const zonedNow = toZonedTime(now, timeZone)
  const zonedTomorrow = addDays(zonedNow, 1)
  const zonedStart = startOfDay(zonedTomorrow)
  const zonedEnd = endOfDay(zonedTomorrow)

  return {
    startOfTomorrow: fromZonedTime(zonedStart, timeZone),
    endOfTomorrow: fromZonedTime(zonedEnd, timeZone),
  }
}

/**
 * Returns the end of the current week (Sunday 23:59:59.999) using Monday–Sunday week convention
 * for the reference instant `now` in `timeZone`.
 */
export function getThisWeekEnd(now: Date, timeZone: string): Date {
  const zonedNow = toZonedTime(now, timeZone)
  const zonedEndOfWeek = endOfWeek(zonedNow, { weekStartsOn: 1 })
  const zonedEndOfSunday = endOfDay(zonedEndOfWeek)

  return fromZonedTime(zonedEndOfSunday, timeZone)
}

/**
 * Converts a date-only input (e.g. "2026-10-15" or a Date) to a UTC instant representing
 * the local end-of-day (23:59:59.999) in the specified `timeZone`.
 */
export function toDateOnlyEndOfDay(dateInput: Date | string, timeZone: string): Date {
  if (typeof dateInput === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateInput)
    if (match) {
      const wallClockString = `${match[1]}-${match[2]}-${match[3]}T23:59:59.999`
      return fromZonedTime(wallClockString, timeZone)
    }
  }

  const dateObj = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  const zoned = toZonedTime(dateObj, timeZone)
  const zonedEnd = endOfDay(zoned)
  return fromZonedTime(zonedEnd, timeZone)
}

/**
 * Pure helper to derive whether a task is overdue given a reference `now`.
 * Never calls Date.now() internally.
 */
export function isTaskOverdue(
  dueAt: string | Date | null | undefined,
  status: string,
  now: Date
): boolean {
  if (!dueAt || status === 'done') {
    return false
  }
  const dueDate = typeof dueAt === 'string' ? new Date(dueAt) : dueAt
  return isBefore(dueDate, now)
}

/**
 * Formats a task due date for display based on dueDateKind and profile timezone.
 */
export function formatTaskDueDate(
  dueAt: string | null | undefined,
  dueDateKind: DueDateKind | undefined,
  timeZone: string
): string {
  if (!dueAt) return ''
  const date = new Date(dueAt)
  if (dueDateKind === 'date_only') {
    return `Đến hạn trong ngày: ${formatInTimeZone(date, timeZone, 'dd/MM/yyyy')}`
  }
  return formatInTimeZone(date, timeZone, 'dd/MM/yyyy HH:mm')
}

/**
 * Derives a human-readable overdue duration string.
 */
export function getOverdueDurationString(dueAt: string | Date, now: Date): string {
  const dueDate = typeof dueAt === 'string' ? new Date(dueAt) : dueAt
  const diffMs = now.getTime() - dueDate.getTime()
  if (diffMs <= 0) return ''
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  if (diffMinutes < 60) return `Quá hạn ${diffMinutes} phút`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `Quá hạn ${diffHours} giờ`
  const diffDays = Math.floor(diffHours / 24)
  return `Quá hạn ${diffDays} ngày`
}

/**
 * Combines local date and optional time into a UTC ISO string with dueDateKind.
 */
export function toTaskDueInstant(
  dateStr: string,
  timeStr: string | null | undefined,
  timeZone: string
): { dueAt: string; dueDateKind: DueDateKind } {
  if (!timeStr || !timeStr.trim()) {
    const endOfDay = toDateOnlyEndOfDay(dateStr, timeZone)
    return { dueAt: endOfDay.toISOString(), dueDateKind: 'date_only' }
  }
  const wallClock = `${dateStr}T${timeStr.trim()}:00`
  const instant = fromZonedTime(wallClock, timeZone)
  return { dueAt: instant.toISOString(), dueDateKind: 'date_time' }
}

/**
 * Extracts local date (YYYY-MM-DD) and time (HH:mm) strings from a UTC instant.
 */
export function fromTaskDueInstant(
  dueAt: string | null | undefined,
  dueDateKind: DueDateKind | undefined,
  timeZone: string
): { dateStr: string; timeStr: string } {
  if (!dueAt) return { dateStr: '', timeStr: '' }
  const date = new Date(dueAt)
  const dateStr = formatInTimeZone(date, timeZone, 'yyyy-MM-dd')
  const timeStr = dueDateKind === 'date_only' ? '' : formatInTimeZone(date, timeZone, 'HH:mm')
  return { dateStr, timeStr }
}

/**
 * Formats a Date instant in the specified timeZone using date-fns-tz format string.
 */
export function formatDisplayDate(date: Date, timeZone: string, formatStr: string): string {
  return formatInTimeZone(date, timeZone, formatStr)
}

/**
 * Returns date shortcut presets (YYYY-MM-DD) for today, tomorrow, weekend, and next week.
 */
export function getDatePickerPresets(
  timeZone: string,
  now: Date = new Date()
): {
  todayStr: string
  tomorrowStr: string
  weekendStr: string
  nextWeekStr: string
} {
  return {
    todayStr: formatInTimeZone(now, timeZone, 'yyyy-MM-dd'),
    tomorrowStr: formatInTimeZone(addDays(now, 1), timeZone, 'yyyy-MM-dd'),
    weekendStr: formatInTimeZone(nextSaturday(now), timeZone, 'yyyy-MM-dd'),
    nextWeekStr: formatInTimeZone(nextMonday(now), timeZone, 'yyyy-MM-dd'),
  }
}

export interface CalendarCell {
  dateStr: string // YYYY-MM-DD
  dayNumber: number
  isCurrentMonth: boolean
  isToday: boolean
}

/**
 * Builds a 35 or 42 cell calendar grid for a given year and month (1-indexed: 1..12).
 * Week starts on Monday (T2..CN).
 */
export function getCalendarMonthGrid(
  year: number,
  month: number, // 1 to 12
  timeZone: string,
  now: Date = new Date()
): {
  cells: CalendarCell[]
  monthTitle: string
} {
  const todayStr = formatInTimeZone(now, timeZone, 'yyyy-MM-dd')

  const firstDay = new Date(year, month - 1, 1)
  const rawDayOfWeek = firstDay.getDay()
  const startOffset = (rawDayOfWeek + 6) % 7 // Monday = 0

  const daysInCurrentMonth = new Date(year, month, 0).getDate()
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate()

  const cells: CalendarCell[] = []

  // Prev month tail
  for (let i = startOffset - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i
    const prevMonthDate = new Date(year, month - 2, day)
    const dateStr = formatInTimeZone(prevMonthDate, timeZone, 'yyyy-MM-dd')
    cells.push({
      dateStr,
      dayNumber: day,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    })
  }

  // Current month days
  for (let day = 1; day <= daysInCurrentMonth; day++) {
    const curDate = new Date(year, month - 1, day)
    const dateStr = formatInTimeZone(curDate, timeZone, 'yyyy-MM-dd')
    cells.push({
      dateStr,
      dayNumber: day,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
    })
  }

  // Next month head
  const totalCells = cells.length > 35 ? 42 : 35
  const remaining = totalCells - cells.length
  for (let day = 1; day <= remaining; day++) {
    const nextDate = new Date(year, month, day)
    const dateStr = formatInTimeZone(nextDate, timeZone, 'yyyy-MM-dd')
    cells.push({
      dateStr,
      dayNumber: day,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    })
  }

  return {
    cells,
    monthTitle: `Tháng ${month}, ${year}`,
  }
}

/**
 * Parses local date (YYYY-MM-DD) and time (HH:mm) strings in the specified IANA timeZone
 * into a UTC ISO string.
 *
 * DST handling:
 * - Spring-forward gap (nonexistent wall time): throws an Error rejecting the invalid time.
 * - Fall-back fold (ambiguous/repeated wall time): chooses the earlier occurrence and reports its UTC offset.
 */
export function parseScheduleLocalDateTime(
  dateStr: string,
  timeStr: string,
  timeZone: string
): { instant: string; offsetString: string; isAmbiguous: boolean } {
  const trimmedTime = timeStr.trim()
  const wallClock = `${dateStr}T${trimmedTime}:00`
  const initialDate = fromZonedTime(wallClock, timeZone)
  const expectedWall = `${dateStr}T${trimmedTime}`
  const roundTripWall = formatInTimeZone(initialDate, timeZone, "yyyy-MM-dd'T'HH:mm")

  // Check for spring-forward nonexistent wall time
  if (roundTripWall !== expectedWall) {
    throw new Error(
      `Nonexistent local time '${dateStr} ${trimmedTime}' in time zone '${timeZone}' due to daylight saving change.`
    )
  }

  // Check for fall-back repeated wall time
  const earlierCandidate = new Date(initialDate.getTime() - 3600000)
  const laterCandidate = new Date(initialDate.getTime() + 3600000)
  const isEarlierSameWall =
    formatInTimeZone(earlierCandidate, timeZone, "yyyy-MM-dd'T'HH:mm") === expectedWall
  const isLaterSameWall =
    formatInTimeZone(laterCandidate, timeZone, "yyyy-MM-dd'T'HH:mm") === expectedWall

  // We choose the earlier occurrence on fall-back
  const finalDate = isEarlierSameWall ? earlierCandidate : initialDate
  const offsetString = formatInTimeZone(finalDate, timeZone, 'xxx')
  const isAmbiguous = isEarlierSameWall || isLaterSameWall

  return {
    instant: finalDate.toISOString(),
    offsetString,
    isAmbiguous,
  }
}

/**
 * Converts a UTC instant into local date (YYYY-MM-DD), local time (HH:mm), and UTC offset string (e.g. +07:00, -04:00).
 */
export function fromScheduleInstant(
  instant: string | Date,
  timeZone: string
): { dateStr: string; timeStr: string; offsetString: string } {
  const date = typeof instant === 'string' ? new Date(instant) : instant
  const dateStr = formatInTimeZone(date, timeZone, 'yyyy-MM-dd')
  const timeStr = formatInTimeZone(date, timeZone, 'HH:mm')
  const offsetString = formatInTimeZone(date, timeZone, 'xxx')
  return { dateStr, timeStr, offsetString }
}

/**
 * Returns [start, end) UTC ISO boundaries for a local day (00:00:00.000 to next day 00:00:00.000).
 */
export function getVisibleRangeForDay(
  referenceDate: Date | string,
  timeZone: string
): { startAt: string; endAt: string } {
  const dateObj = typeof referenceDate === 'string' ? new Date(referenceDate) : referenceDate
  const zoned = toZonedTime(dateObj, timeZone)
  const localStart = startOfDay(zoned)
  const localEnd = startOfDay(addDays(zoned, 1))

  return {
    startAt: fromZonedTime(localStart, timeZone).toISOString(),
    endAt: fromZonedTime(localEnd, timeZone).toISOString(),
  }
}

/**
 * Returns [start, end) UTC ISO boundaries for a local Monday–Sunday week (Monday 00:00:00.000 to next Monday 00:00:00.000).
 */
export function getVisibleRangeForWeek(
  referenceDate: Date | string,
  timeZone: string
): { startAt: string; endAt: string } {
  const dateObj = typeof referenceDate === 'string' ? new Date(referenceDate) : referenceDate
  const zoned = toZonedTime(dateObj, timeZone)
  const localStart = startOfWeek(zoned, { weekStartsOn: 1 })
  const localEnd = addDays(localStart, 7)

  return {
    startAt: fromZonedTime(localStart, timeZone).toISOString(),
    endAt: fromZonedTime(localEnd, timeZone).toISOString(),
  }
}

/**
 * Returns [start, end) UTC ISO boundaries for the upcoming N complete local days
 * starting from tomorrow 00:00:00.000 (excluding today).
 */
export function getVisibleRangeForNextDays(
  referenceDate: Date | string,
  timeZone: string,
  days = 7
): { startAt: string; endAt: string } {
  const dateObj = typeof referenceDate === 'string' ? new Date(referenceDate) : referenceDate
  const zoned = toZonedTime(dateObj, timeZone)
  const nextDayStart = startOfDay(addDays(zoned, 1))
  const endAt = startOfDay(addDays(nextDayStart, days))

  return {
    startAt: fromZonedTime(nextDayStart, timeZone).toISOString(),
    endAt: fromZonedTime(endAt, timeZone).toISOString(),
  }
}

/**
 * Formats a task's completedAt timestamp for display in the client's timezone.
 * Returns localized Vietnamese string e.g. "09/10/2026 14:30"
 */
export function formatTaskCompletedAt(
  completedAt: string | null | undefined,
  timeZone: string
): string | null {
  if (!completedAt) return null
  const date = new Date(completedAt)
  if (isNaN(date.getTime())) return null
  return formatInTimeZone(date, timeZone, 'dd/MM/yyyy HH:mm')
}

/**
 * Calculates start and end UTC boundary instants for a given completion range filter.
 */
export function getCompletedRangeBoundaries(
  range: 'today' | 'yesterday' | '7days' | '30days' | 'all' | string,
  timeZone: string,
  now: Date = new Date()
): { from?: string; to?: string } {
  const zonedNow = toZonedTime(now, timeZone)
  switch (range) {
    case 'today': {
      const start = fromZonedTime(startOfDay(zonedNow), timeZone)
      const end = fromZonedTime(endOfDay(zonedNow), timeZone)
      return { from: start.toISOString(), to: end.toISOString() }
    }
    case 'yesterday': {
      const yesterdayZoned = addDays(zonedNow, -1)
      const start = fromZonedTime(startOfDay(yesterdayZoned), timeZone)
      const end = fromZonedTime(endOfDay(yesterdayZoned), timeZone)
      return { from: start.toISOString(), to: end.toISOString() }
    }
    case '7days': {
      const past7 = addDays(zonedNow, -7)
      const start = fromZonedTime(startOfDay(past7), timeZone)
      const end = fromZonedTime(endOfDay(zonedNow), timeZone)
      return { from: start.toISOString(), to: end.toISOString() }
    }
    case '30days': {
      const past30 = addDays(zonedNow, -30)
      const start = fromZonedTime(startOfDay(past30), timeZone)
      const end = fromZonedTime(endOfDay(zonedNow), timeZone)
      return { from: start.toISOString(), to: end.toISOString() }
    }
    default:
      return {}
  }
}
