import { useQuery } from '@tanstack/react-query'
import {
  getScheduleBlocksByTask,
  getScheduleBlocksInRange,
} from '../api/schedule-blocks'
import { scheduleQueryKeys } from '../query-keys'

export function useScheduleBlocksInRange({
  startAt,
  endAt,
  enabled = true,
}: {
  startAt?: string
  endAt?: string
  enabled?: boolean
}) {
  return useQuery({
    queryKey: scheduleQueryKeys.range(startAt || '', endAt || ''),
    queryFn: () => {
      if (!startAt || !endAt) return []
      return getScheduleBlocksInRange(undefined, startAt, endAt)
    },
    enabled: Boolean(enabled && startAt && endAt),
  })
}

export function useScheduleBlocksByTask(taskId: string | null | undefined) {
  return useQuery({
    queryKey: scheduleQueryKeys.byTask(taskId || ''),
    queryFn: () => {
      if (!taskId) return []
      return getScheduleBlocksByTask(undefined, taskId)
    },
    enabled: Boolean(taskId),
  })
}
