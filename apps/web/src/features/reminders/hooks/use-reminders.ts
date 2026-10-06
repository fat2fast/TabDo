import { useQuery } from '@tanstack/react-query'
import { getRemindersByTask, getUpcomingRemindersWeb } from '../api/reminders'
import { reminderQueryKeys } from '../query-keys'

export function useRemindersByTask(taskId: string | null | undefined) {
  return useQuery({
    queryKey: reminderQueryKeys.byTask(taskId || ''),
    queryFn: () => {
      if (!taskId) return []
      return getRemindersByTask(undefined, taskId)
    },
    enabled: Boolean(taskId),
  })
}

export function useUpcomingReminders(now: Date = new Date()) {
  return useQuery({
    queryKey: reminderQueryKeys.upcoming(),
    queryFn: () => getUpcomingRemindersWeb(undefined, now),
  })
}
