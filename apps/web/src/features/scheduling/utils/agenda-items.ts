import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { parseISO, isBefore, isAfter, addDays } from 'date-fns'
import type { ScheduleBlock } from '../types'

export interface AgendaItem {
  id: string // Unique key for the segment: `${block.id}_${dateStr}`
  blockId: string
  title: string
  dateStr: string // YYYY-MM-DD in user's timezone
  startTime: string // HH:mm
  endTime: string // HH:mm
  isAllDay: boolean
  isSpillover: boolean // Began on a previous day
  spansNextDay: boolean // Extends into next day
  block: ScheduleBlock // Original unmutated block reference
}

export interface AgendaDayGroup {
  dateStr: string // YYYY-MM-DD
  dayLabel: string
  isToday: boolean
  items: AgendaItem[]
}

/**
 * Returns a Date object representing 12:00:00 wall-clock time on dateStr
 * in the target timeZone (pure UTC representation, zero dependence on machine timezone).
 */
function getZonedNoonDate(dateStr: string, timeZone: string): Date {
  return fromZonedTime(`${dateStr}T12:00:00`, timeZone)
}

/**
 * Builds chronological day groups of agenda items from schedule blocks within visible range.
 * Respects user's timezone, splits blocks that cross midnight into local day segments,
 * clamps segments strictly to the visible range, and preserves exact underlying block references.
 */
export function buildAgendaItems(
  blocks: ScheduleBlock[],
  visibleRange: { startAt: string; endAt: string },
  timeZone: string
): AgendaDayGroup[] {
  const rangeStart = parseISO(visibleRange.startAt)
  const rangeEnd = parseISO(visibleRange.endAt)
  const todayStr = formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd')

  // Map to collect items per day: dateStr -> AgendaItem[]
  const dayItemsMap = new Map<string, AgendaItem[]>()

  for (const block of blocks) {
    const blockStart = parseISO(block.startAt)
    const blockEnd = parseISO(block.endAt)

    // Skip blocks that don't intersect visible range at all
    if (!isBefore(blockStart, rangeEnd) || !isAfter(blockEnd, rangeStart)) {
      continue
    }

    // Convert start and end to local date strings in user's timezone
    const startDayStr = formatInTimeZone(blockStart, timeZone, 'yyyy-MM-dd')
    const endDayStr = formatInTimeZone(blockEnd, timeZone, 'yyyy-MM-dd')

    if (startDayStr === endDayStr) {
      // Single day block
      if (isBefore(blockStart, rangeEnd) && isAfter(blockEnd, rangeStart)) {
        const startTime = formatInTimeZone(blockStart, timeZone, 'HH:mm')
        const endTime = formatInTimeZone(blockEnd, timeZone, 'HH:mm')
        const isAllDay = startTime === '00:00' && (endTime === '23:59' || endTime === '00:00')

        const item: AgendaItem = {
          id: `${block.id}_${startDayStr}`,
          blockId: block.id,
          title: block.title,
          dateStr: startDayStr,
          startTime,
          endTime,
          isAllDay,
          isSpillover: false,
          spansNextDay: false,
          block,
        }

        if (!dayItemsMap.has(startDayStr)) {
          dayItemsMap.set(startDayStr, [])
        }
        dayItemsMap.get(startDayStr)!.push(item)
      }
    } else {
      // Block crosses midnight into 2 or more local calendar days
      // Iterate through local calendar days starting from startDayStr up to endDayStr
      let refDate = getZonedNoonDate(startDayStr, timeZone)
      let curDayStr = startDayStr

      while (curDayStr <= endDayStr) {
        const isFirstDay = curDayStr === startDayStr
        const isLastDay = curDayStr === endDayStr

        const startTime = isFirstDay ? formatInTimeZone(blockStart, timeZone, 'HH:mm') : '00:00'
        const endTime = isLastDay ? formatInTimeZone(blockEnd, timeZone, 'HH:mm') : '23:59'

        // Only include if end is not exactly midnight (00:00) on last day
        if (!(isLastDay && endTime === '00:00')) {
          // Calculate UTC instant boundaries for this specific day segment
          const segmentStart = isFirstDay ? blockStart : fromZonedTime(`${curDayStr}T00:00:00`, timeZone)
          const segmentEnd = isLastDay ? blockEnd : fromZonedTime(`${curDayStr}T23:59:59.999`, timeZone)

          // Clamp to visibleRange: segment must intersect [rangeStart, rangeEnd)
          if (isBefore(segmentStart, rangeEnd) && isAfter(segmentEnd, rangeStart)) {
            const item: AgendaItem = {
              id: `${block.id}_${curDayStr}`,
              blockId: block.id,
              title: block.title,
              dateStr: curDayStr,
              startTime,
              endTime,
              isAllDay: !isFirstDay && !isLastDay,
              isSpillover: !isFirstDay,
              spansNextDay: !isLastDay,
              block,
            }

            if (!dayItemsMap.has(curDayStr)) {
              dayItemsMap.set(curDayStr, [])
            }
            dayItemsMap.get(curDayStr)!.push(item)
          }
        }

        if (curDayStr === endDayStr) break
        refDate = addDays(refDate, 1)
        curDayStr = formatInTimeZone(refDate, timeZone, 'yyyy-MM-dd')
      }
    }
  }

  // Sort day keys chronologically
  const sortedDays = Array.from(dayItemsMap.keys()).sort()

  const groups: AgendaDayGroup[] = sortedDays.map((dateStr) => {
    const dateObj = getZonedNoonDate(dateStr, timeZone)
    const dayLabel = formatInTimeZone(dateObj, timeZone, "EEEE, 'ngày' dd/MM/yyyy")
    const isToday = dateStr === todayStr

    // Sort items within day deterministically: startTime -> endTime -> blockId
    const items = dayItemsMap.get(dateStr)!
    items.sort((a, b) => {
      if (a.startTime !== b.startTime) {
        return a.startTime.localeCompare(b.startTime)
      }
      if (a.endTime !== b.endTime) {
        return a.endTime.localeCompare(b.endTime)
      }
      return a.blockId.localeCompare(b.blockId)
    })

    return {
      dateStr,
      dayLabel,
      isToday,
      items,
    }
  })

  return groups
}
