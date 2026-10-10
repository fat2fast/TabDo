import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from '../api/categories'
import {
  completeTask,
  createTask,
  deleteTask,
  reopenTask,
  updateTask,
} from '../api/tasks'
import { categoryQueryKeys, taskQueryKeys } from '../query-keys'
import { scheduleQueryKeys } from '../../scheduling/query-keys'
import { reminderQueryKeys } from '../../reminders/query-keys'
import { summaryQueryKeys } from '../../summary/query-keys'
import type {
  CreateCategoryInput,
  CreateTaskInput,
  Task,
  UpdateCategoryInput,
  UpdateTaskInput,
} from '../types'

export function useTaskMutations() {
  const queryClient = useQueryClient()

  const createTaskMutation = useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: (newTask) => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: summaryQueryKeys.all })
      if (newTask.parentId) {
        queryClient.invalidateQueries({
          queryKey: taskQueryKeys.subtasks(newTask.parentId),
        })
      }
    },
  })

  const updateTaskMutation = useMutation({
    mutationFn: ({
      id,
      input,
      previousTask,
    }: {
      id: string
      input: UpdateTaskInput
      previousTask?: Task
    }) => updateTask(id, input, previousTask),
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() })
      queryClient.invalidateQueries({
        queryKey: taskQueryKeys.detail(updatedTask.id),
      })
      queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: reminderQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: summaryQueryKeys.all })
      if (updatedTask.parentId) {
        queryClient.invalidateQueries({
          queryKey: taskQueryKeys.subtasks(updatedTask.parentId),
        })
      }
    },
  })

  const deleteTaskMutation = useMutation({
    mutationFn: ({ id }: { id: string; parentId?: string | null }) =>
      deleteTask(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() })
      queryClient.invalidateQueries({
        queryKey: taskQueryKeys.detail(variables.id),
      })
      queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: reminderQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: summaryQueryKeys.all })
      if (variables.parentId) {
        queryClient.invalidateQueries({
          queryKey: taskQueryKeys.subtasks(variables.parentId),
        })
      }
    },
  })

  const completeTaskMutation = useMutation({
    mutationFn: (task: Task) => completeTask(task),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() })
      queryClient.invalidateQueries({
        queryKey: taskQueryKeys.detail(result.completedTask.id),
      })
      if (result.nextTask) {
        queryClient.invalidateQueries({
          queryKey: taskQueryKeys.detail(result.nextTask.id),
        })
      }
      queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: reminderQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: summaryQueryKeys.all })
      if (result.completedTask.parentId) {
        queryClient.invalidateQueries({
          queryKey: taskQueryKeys.subtasks(result.completedTask.parentId),
        })
      }
    },
  })

  const reopenTaskMutation = useMutation({
    mutationFn: (task: Task) => reopenTask(task),
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() })
      queryClient.invalidateQueries({
        queryKey: taskQueryKeys.detail(updatedTask.id),
      })
      queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: reminderQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: summaryQueryKeys.all })
      if (updatedTask.parentId) {
        queryClient.invalidateQueries({
          queryKey: taskQueryKeys.subtasks(updatedTask.parentId),
        })
      }
    },
  })

  const createCategoryMutation = useMutation({
    mutationFn: (input: CreateCategoryInput) => createCategory(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: summaryQueryKeys.all })
    },
  })

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCategoryInput }) =>
      updateCategory(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: summaryQueryKeys.all })
    },
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: summaryQueryKeys.all })
    },
  })

  return {
    createTaskMutation,
    updateTaskMutation,
    deleteTaskMutation,
    completeTaskMutation,
    reopenTaskMutation,
    createCategoryMutation,
    updateCategoryMutation,
    deleteCategoryMutation,
  }
}
