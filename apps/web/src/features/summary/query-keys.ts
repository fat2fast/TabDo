import type { SummaryPeriod } from './types'

export const summaryQueryKeys = {
  all: ['summary'] as const,
  user: (userId: string) => [...summaryQueryKeys.all, userId] as const,
  detail: (
    userId: string,
    timeZone: string,
    period: SummaryPeriod,
    dateStr: string
  ) => [...summaryQueryKeys.user(userId), timeZone, period, dateStr] as const,
}
