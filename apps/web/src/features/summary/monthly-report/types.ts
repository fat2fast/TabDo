import type { Task, Category } from '../../tasks/types'

export type ReportPeriodType = 'monthly' | 'quarterly' | 'custom'

export interface MonthlyReportPeriod {
  type: 'monthly'
  monthStr: string // YYYY-MM
}

export interface QuarterlyReportPeriod {
  type: 'quarterly'
  year: number
  quarter: number // 1, 2, 3, 4
}

export interface CustomReportPeriod {
  type: 'custom'
  startDateStr: string // YYYY-MM-DD
  endDateStr: string // YYYY-MM-DD
}

export type ReportPeriod =
  | MonthlyReportPeriod
  | QuarterlyReportPeriod
  | CustomReportPeriod

export interface ReportRange {
  type: ReportPeriodType
  startAt: string // UTC ISO string [startAt, endAt)
  endAt: string // UTC ISO string
  displayPeriod: string // e.g. "Tháng 10/2026" or "Từ 01/10/2026 đến 15/10/2026"
  fileSlug: string // e.g. "thang-10-2026" or "01-10-2026_15-10-2026"
  timeZone: string
}

export interface ReportWorkItem {
  taskId: string
  categoryName: string
  title: string
  dueAtDateSerial: number | null
  dueAtDisplay: string
  statusText: 'Hoàn thành' | 'Đang thực hiện' | 'Chưa thực hiện'
}

export interface ReportSummaryGroup {
  name: string
  totalCount: number
  completedCount: number
}

export interface ReportData {
  departmentText: string
  reporterName: string
  reportDateText: string
  jobTitleText: string
  periodText: string
  items: ReportWorkItem[]
  categories: string[] // Unique category names in stable order
}

export interface ReportTaskCandidate {
  task: Task
  categoryName: string
}
