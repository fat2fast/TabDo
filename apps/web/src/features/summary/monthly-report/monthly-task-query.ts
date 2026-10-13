import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, startOfDay } from 'date-fns'
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz'
import { parseLocalDateReference } from '@tabdo/utils'
import { supabase as defaultClient } from '../../../lib/supabase'
import {
  type Category,
  type CategoryRow,
  type Task,
  type TaskRow,
  rowToCategory,
  rowToTask,
} from '../../tasks/types'
import type {
  ReportPeriod,
  ReportRange,
  ReportTaskCandidate,
} from './types'

const PAGE_SIZE = 500

export function calculateReportRange(
  period: ReportPeriod,
  timeZone: string
): ReportRange {
  if (period.type === 'monthly') {
    const match = /^(\d{4})-(\d{2})$/.exec(period.monthStr.trim())
    if (!match) {
      throw new Error(`Invalid month format "${period.monthStr}". Expected YYYY-MM.`)
    }
    const year = parseInt(match[1], 10)
    const month = parseInt(match[2], 10)
    if (month < 1 || month > 12) {
      throw new Error(`Invalid month value: ${month}. Expected 1-12.`)
    }

    const startWall = `${match[1]}-${match[2]}-01T00:00:00`
    const nextYear = month === 12 ? year + 1 : year
    const nextMonth = month === 12 ? 1 : month + 1
    const nextMonthStr = String(nextMonth).padStart(2, '0')
    const endWall = `${nextYear}-${nextMonthStr}-01T00:00:00`

    const startAt = fromZonedTime(startWall, timeZone).toISOString()
    const endAt = fromZonedTime(endWall, timeZone).toISOString()

    const monthFormatted = String(month).padStart(2, '0')
    const lastDay = new Date(year, month, 0).getDate()
    const lastDayFormatted = String(lastDay).padStart(2, '0')
    const startDisplay = `01/${monthFormatted}/${year}`
    const endDisplay = `${lastDayFormatted}/${monthFormatted}/${year}`

    return {
      type: 'monthly',
      startAt,
      endAt,
      displayPeriod: `: ${monthFormatted}/${year} (Thời gian thực hiện từ ${startDisplay} - ${endDisplay})`,
      fileSlug: `thang-${monthFormatted}-${year}`,
      timeZone,
    }
  }

  if (period.type === 'quarterly') {
    const { year, quarter } = period
    if (quarter < 1 || quarter > 4) {
      throw new Error(`Invalid quarter value: ${quarter}. Expected 1-4.`)
    }
    const startMonth = (quarter - 1) * 3 + 1
    const endMonth = quarter * 3
    const startMonthStr = String(startMonth).padStart(2, '0')
    const endMonthStr = String(endMonth).padStart(2, '0')
    const startWall = `${year}-${startMonthStr}-01T00:00:00`
    const nextYear = quarter === 4 ? year + 1 : year
    const nextMonth = quarter === 4 ? 1 : endMonth + 1
    const nextMonthStr = String(nextMonth).padStart(2, '0')
    const endWall = `${nextYear}-${nextMonthStr}-01T00:00:00`

    const startAt = fromZonedTime(startWall, timeZone).toISOString()
    const endAt = fromZonedTime(endWall, timeZone).toISOString()

    const lastDay = new Date(year, endMonth, 0).getDate()
    const lastDayFormatted = String(lastDay).padStart(2, '0')
    const startDisplay = `01/${startMonthStr}/${year}`
    const endDisplay = `${lastDayFormatted}/${endMonthStr}/${year}`

    return {
      type: 'quarterly',
      startAt,
      endAt,
      displayPeriod: `: Quý ${quarter}/${year} (Thời gian thực hiện từ ${startDisplay} - ${endDisplay})`,
      fileSlug: `quy-${quarter}-${year}`,
      timeZone,
    }
  }

  // Custom date range
  const startMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(period.startDateStr.trim())
  const endMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(period.endDateStr.trim())
  if (!startMatch || !endMatch) {
    throw new Error('Invalid date range format. Expected YYYY-MM-DD.')
  }

  const startWall = `${period.startDateStr.trim()}T00:00:00`
  const startInstant = fromZonedTime(startWall, timeZone)

  const endRef = parseLocalDateReference(period.endDateStr, timeZone)
  const endZoned = toZonedTime(endRef, timeZone)
  const nextDayZoned = addDays(startOfDay(endZoned), 1)
  const endInstant = fromZonedTime(nextDayZoned, timeZone)

  if (endInstant.getTime() <= startInstant.getTime()) {
    throw new Error('End date must be on or after start date.')
  }

  const startDisplay = formatInTimeZone(startInstant, timeZone, 'dd/MM/yyyy')
  const endDisplay = formatInTimeZone(endRef, timeZone, 'dd/MM/yyyy')
  const startSlug = formatInTimeZone(startInstant, timeZone, 'dd-MM-yyyy')
  const endSlug = formatInTimeZone(endRef, timeZone, 'dd-MM-yyyy')

  return {
    type: 'custom',
    startAt: startInstant.toISOString(),
    endAt: endInstant.toISOString(),
    displayPeriod: `: (Thời gian thực hiện từ ${startDisplay} - ${endDisplay})`,
    fileSlug: `${startSlug}_${endSlug}`,
    timeZone,
  }
}

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const all: T[] = []
  let from = 0

  while (true) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await fetchPage(from, to)

    if (error) {
      const message =
        error instanceof Error
          ? error.message
          : (error as { message?: string })?.message || 'Database query failed'
      throw new Error(message)
    }

    const rows = data || []
    all.push(...rows)

    if (rows.length < PAGE_SIZE) {
      break
    }
    from += PAGE_SIZE
  }

  return all
}

export interface FetchCandidatesOptions {
  client?: SupabaseClient
  range: ReportRange
}

export async function fetchMonthlyReportCandidateTasks(
  options: FetchCandidatesOptions
): Promise<{ candidates: ReportTaskCandidate[]; categories: Category[] }> {
  const client = options.client ?? defaultClient
  const { startAt, endAt } = options.range

  // 1. Fetch categories
  const categoryRows = await fetchAllPages<CategoryRow>((from, to) =>
    client.from('categories').select('*').order('name', { ascending: true }).range(from, to)
  )
  const categories: Category[] = categoryRows.map(rowToCategory)
  const categoryMap = new Map<string, string>()
  for (const cat of categories) {
    categoryMap.set(cat.id, cat.name)
  }

  // 2. Fetch candidate tasks concurrently across potential match criteria
  // All queries enforce deleted_at is null
  const duePromise = fetchAllPages<TaskRow>((from, to) => {
    let q = client.from('tasks').select('*')
    if (typeof (q as any).is === 'function') {
      q = q.is('deleted_at', null)
    }
    return q
      .gte('due_at', startAt)
      .lt('due_at', endAt)
      .order('id', { ascending: true })
      .range(from, to)
  })

  const completedPromise = fetchAllPages<TaskRow>((from, to) => {
    let q = client.from('tasks').select('*')
    if (typeof (q as any).is === 'function') {
      q = q.is('deleted_at', null)
    }
    return q
      .gte('completed_at', startAt)
      .lt('completed_at', endAt)
      .order('id', { ascending: true })
      .range(from, to)
  })

  const createdPromise = fetchAllPages<TaskRow>((from, to) => {
    let q = client.from('tasks').select('*')
    if (typeof (q as any).is === 'function') {
      q = q.is('deleted_at', null)
    }
    return q
      .gte('created_at', startAt)
      .lt('created_at', endAt)
      .order('id', { ascending: true })
      .range(from, to)
  })

  const startPromise = fetchAllPages<TaskRow>((from, to) => {
    let q = client.from('tasks').select('*')
    if (typeof (q as any).is === 'function') {
      q = q.is('deleted_at', null)
    }
    return q
      .gte('start_at', startAt)
      .lt('start_at', endAt)
      .order('id', { ascending: true })
      .range(from, to)
  })

  const intervalOverlapPromise = fetchAllPages<TaskRow>((from, to) => {
    let q = client.from('tasks').select('*')
    if (typeof (q as any).is === 'function') {
      q = q.is('deleted_at', null)
    }
    return q
      .lt('start_at', endAt)
      .gte('due_at', startAt)
      .order('id', { ascending: true })
      .range(from, to)
  })

  const [dueRows, completedRows, createdRows, startRows, overlapRows] = await Promise.all([
    duePromise,
    completedPromise,
    createdPromise,
    startPromise,
    intervalOverlapPromise,
  ])

  // 3. Dedup by task ID
  const taskMap = new Map<string, Task>()
  const allRows = [
    ...dueRows,
    ...completedRows,
    ...createdRows,
    ...startRows,
    ...overlapRows,
  ]

  for (const r of allRows) {
    if (r.deleted_at != null) continue
    if (!taskMap.has(r.id)) {
      taskMap.set(r.id, rowToTask(r))
    }
  }

  // 4. Stable sort: by relevant date, then by ID
  const tasks = Array.from(taskMap.values()).sort((a, b) => {
    const dateA = a.dueAt || a.startAt || a.completedAt || a.createdAt
    const dateB = b.dueAt || b.startAt || b.completedAt || b.createdAt
    const timeA = new Date(dateA).getTime()
    const timeB = new Date(dateB).getTime()
    if (timeA !== timeB) return timeA - timeB
    return a.id.localeCompare(b.id)
  })

  // 5. Map candidates with resolved category name
  const candidates: ReportTaskCandidate[] = tasks.map((task) => {
    const categoryName =
      (task.categoryId ? categoryMap.get(task.categoryId) : undefined) || 'Không phân loại'
    return {
      task,
      categoryName,
    }
  })

  return { candidates, categories }
}
