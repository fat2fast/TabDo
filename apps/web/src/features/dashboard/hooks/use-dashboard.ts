import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatInTimeZone } from 'date-fns-tz'
import { useAuth } from '../../auth/auth-provider'
import { fetchDashboardSnapshot } from '../api/dashboard'
import { dashboardQueryKeys } from '../query-keys'
import type { DashboardSnapshot } from '../types'

export function useDashboard(referenceNow?: Date) {
  const { profile } = useAuth()
  const timeZone = profile?.timezone || 'Asia/Ho_Chi_Minh'
  const now = referenceNow ?? new Date()
  const dateStr = formatInTimeZone(now, timeZone, 'yyyy-MM-dd')
  const queryClient = useQueryClient()

  const query = useQuery<DashboardSnapshot, Error>({
    queryKey: dashboardQueryKeys.snapshot(dateStr, timeZone),
    queryFn: () => fetchDashboardSnapshot({ timeZone, now }),
    staleTime: 60 * 1000,
  })

  // Automatically invalidate the dashboard query when the local day rolls over at midnight,
  // so a page left open past midnight always shows the new day's snapshot.
  useEffect(() => {
    if (referenceNow) return // skip when a fixed reference time is injected (e.g. tests)

    const computeMsToMidnight = () => {
      const n = new Date()
      // Build the start of tomorrow in local timezone by parsing the *next* date string
      const tomorrowDateStr = formatInTimeZone(
        new Date(n.getTime() + 24 * 60 * 60 * 1000),
        timeZone,
        'yyyy-MM-dd'
      )
      // Midnight in the user's timezone is when tomorrow's dateStr begins
      // Compute ms until 00:00:00.001 local tomorrow — use UTC+offset approach via Date
      const localMidnightApprox = new Date(`${tomorrowDateStr}T00:00:00`)
      // localMidnightApprox is in LOCAL time — convert to UTC for scheduling
      return Math.max(localMidnightApprox.getTime() - n.getTime() + 1000, 1000)
    }

    let timerId: ReturnType<typeof setTimeout>

    const scheduleRollover = () => {
      const delay = computeMsToMidnight()
      timerId = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all })
        // Re-schedule for next midnight (handles the edge case of staying open multiple days)
        scheduleRollover()
      }, delay)
    }

    scheduleRollover()

    return () => clearTimeout(timerId)
  }, [timeZone, queryClient, referenceNow])

  return {
    ...query,
    snapshot: query.data,
    metrics: query.data?.metrics,
    priorityTasks: query.data?.priorityTasks ?? [],
    overdueTasks: query.data?.overdueTasks ?? [],
    todaySchedule: query.data?.todaySchedule ?? [],
    upcomingTasks: query.data?.upcomingTasks ?? [],
    timeZone,
    dateStr,
  }
}
