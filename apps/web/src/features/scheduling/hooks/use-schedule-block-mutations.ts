import { useMutation, useQueryClient } from '@tanstack/react-query'
import { taskQueryKeys } from '../../tasks/query-keys'
import {
  createScheduleBlock,
  deleteScheduleBlock,
  updateScheduleBlock,
} from '../api/schedule-blocks'
import { scheduleQueryKeys } from '../query-keys'
import type {
  CreateScheduleBlockInput,
  DeleteScheduleBlockInput,
  UpdateScheduleBlockInput,
} from '../types'

export function useScheduleBlockMutations() {
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: (input: CreateScheduleBlockInput) => createScheduleBlock(undefined, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all })
      if (data.taskId) {
        queryClient.invalidateQueries({ queryKey: taskQueryKeys.all })
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateScheduleBlockInput }) =>
      updateScheduleBlock(undefined, id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id, previousUpdatedAt }: DeleteScheduleBlockInput) =>
      deleteScheduleBlock(undefined, id, previousUpdatedAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.all })
    },
  })

  return {
    createMutation,
    updateMutation,
    deleteMutation,
  }
}
