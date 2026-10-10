import { useMutation, useQueryClient } from '@tanstack/react-query'
import { taskQueryKeys } from '../../tasks/query-keys'
import {
  createReminder,
  deleteReminder,
  dismissReminder,
  snoozeReminder,
  updateReminder,
} from '../api/reminders'
import { reminderQueryKeys } from '../query-keys'
import type {
  CreateReminderInput,
  DeleteReminderInput,
  UpdateReminderInput,
} from '../types'

export function useReminderMutations() {
  const queryClient = useQueryClient()

  const invalidateAll = (taskId?: string) => {
    queryClient.invalidateQueries({ queryKey: reminderQueryKeys.all })
    queryClient.invalidateQueries({ queryKey: reminderQueryKeys.upcoming() })
    if (taskId) {
      queryClient.invalidateQueries({ queryKey: reminderQueryKeys.byTask(taskId) })
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.detail(taskId) })
    }
  }

  const createMutation = useMutation({
    mutationFn: (input: CreateReminderInput) => createReminder(undefined, input),
    onSuccess: (data) => invalidateAll(data.taskId),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateReminderInput }) =>
      updateReminder(undefined, id, input),
    onSuccess: (data) => invalidateAll(data.taskId),
  })

  const snoozeMutation = useMutation({
    mutationFn: ({
      id,
      snoozedUntil,
      previousUpdatedAt,
    }: {
      id: string
      snoozedUntil: string
      previousUpdatedAt: string
    }) => snoozeReminder(undefined, id, snoozedUntil, previousUpdatedAt),
    onSuccess: (data) => invalidateAll(data.taskId),
  })

  const dismissMutation = useMutation({
    mutationFn: ({
      id,
      previousUpdatedAt,
    }: {
      id: string
      previousUpdatedAt: string
    }) => dismissReminder(undefined, id, previousUpdatedAt),
    onSuccess: (data) => invalidateAll(data.taskId),
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id, previousUpdatedAt }: DeleteReminderInput & { taskId?: string }) =>
      deleteReminder(undefined, id, previousUpdatedAt),
    onSuccess: (_, variables) => invalidateAll(variables.taskId),
  })

  return {
    createMutation,
    updateMutation,
    snoozeMutation,
    dismissMutation,
    deleteMutation,
  }
}
