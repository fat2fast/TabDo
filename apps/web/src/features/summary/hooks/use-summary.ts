import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/auth-provider'
import { fetchSummaryData } from '../api/summary'
import { summaryQueryKeys } from '../query-keys'
import type { SummaryData, SummaryPeriod } from '../types'

export interface UseSummaryOptions {
  period: SummaryPeriod
  selectedDateStr: string
  referenceNow?: Date
}

export function useSummary({
  period,
  selectedDateStr,
  referenceNow,
}: UseSummaryOptions) {
  const { user, profile } = useAuth()
  const timeZone = profile?.timezone || 'Asia/Ho_Chi_Minh'
  const userId = user?.id

  const query = useQuery<SummaryData, Error>({
    queryKey: userId
      ? summaryQueryKeys.detail(userId, timeZone, period, selectedDateStr)
      : ['summary', 'anonymous', timeZone, period, selectedDateStr],
    queryFn: () =>
      fetchSummaryData({
        period,
        selectedDateStr,
        timeZone,
        now: referenceNow,
      }),
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
  })

  return {
    ...query,
    summary: query.data,
    timeZone,
  }
}
