import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import type { UserProfile } from '@tabdo/types'
import type { Task, Category } from '../../tasks/types'
import type {
  ReportData,
  ReportRange,
  ReportWorkItem,
} from './types'

/**
 * Calculates Excel 1900 date system serial number for a local calendar date.
 * Excel epoch: 1899-12-30 (accounting for the 1900 leap year bug).
 */
export function dateToExcelSerial(date: Date, timeZone: string): number {
  const zoned = toZonedTime(date, timeZone)
  const year = zoned.getFullYear()
  const month = zoned.getMonth() // 0-indexed
  const day = zoned.getDate()

  const epoch = Date.UTC(1899, 11, 30)
  const targetUtc = Date.UTC(year, month, day)
  return Math.floor((targetUtc - epoch) / 86400000)
}

export function mapStatusToReportText(
  status: string
): 'Hoàn thành' | 'Đang thực hiện' | 'Chưa thực hiện' {
  switch (status) {
    case 'done':
      return 'Hoàn thành'
    case 'in_progress':
      return 'Đang thực hiện'
    case 'todo':
    default:
      return 'Chưa thực hiện'
  }
}

export interface MapReportDataOptions {
  selectedTasks: Task[]
  categories: Category[]
  profile?: UserProfile | null
  range: ReportRange
  now?: Date
}

export function mapTasksToReportData(options: MapReportDataOptions): ReportData {
  const { selectedTasks, categories, profile, range } = options
  const now = options.now ?? new Date()
  const timeZone = range.timeZone

  const categoryMap = new Map<string, string>()
  for (const cat of categories) {
    categoryMap.set(cat.id, cat.name)
  }

  // 1. Map work items
  const items: ReportWorkItem[] = selectedTasks.map((task) => {
    const categoryName =
      (task.categoryId ? categoryMap.get(task.categoryId) : undefined) || 'Không phân loại'

    let dueAtDateSerial: number | null = null
    let dueAtDisplay = ''
    if (task.dueAt) {
      const dueDate = new Date(task.dueAt)
      if (!isNaN(dueDate.getTime())) {
        dueAtDateSerial = dateToExcelSerial(dueDate, timeZone)
        dueAtDisplay = formatInTimeZone(dueDate, timeZone, 'dd/MM/yyyy')
      }
    }

    const statusText = mapStatusToReportText(task.status)

    return {
      taskId: task.id,
      categoryName,
      title: task.title,
      dueAtDateSerial,
      dueAtDisplay,
      statusText,
    }
  })

  // 2. Extract unique category names in stable order of appearance
  const uniqueCategories: string[] = []
  const seenCategories = new Set<string>()

  for (const item of items) {
    if (!seenCategories.has(item.categoryName)) {
      seenCategories.add(item.categoryName)
      uniqueCategories.push(item.categoryName)
    }
  }

  // 3. Metadata fields
  const reporterRaw = profile?.displayName?.trim() || ''
  const reporterName = reporterRaw
    ? (reporterRaw.startsWith(':') ? reporterRaw : `: ${reporterRaw}`)
    : ': '
  const dateFormatted = formatInTimeZone(now, timeZone, 'dd/MM/yyyy')
  const reportDateText = dateFormatted.startsWith(':') ? dateFormatted : `: ${dateFormatted}`

  return {
    departmentText: '', // Left blank as profiles don't have department field yet
    reporterName,
    reportDateText,
    jobTitleText: '', // Left blank for user to fill in Excel
    periodText: range.displayPeriod,
    items,
    categories: uniqueCategories,
  }
}
