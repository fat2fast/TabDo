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
      if (variables.parentId) {
        queryClient.invalidateQueries({
          queryKey: taskQueryKeys.subtasks(variables.parentId),
        })
      }
    },
  })

  const completeTaskMutation = useMutation({
    mutationFn: (task: Task) => completeTask(task),
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() })
      queryClient.invalidateQueries({
        queryKey: taskQueryKeys.detail(updatedTask.id),
      })
      if (updatedTask.parentId) {
        queryClient.invalidateQueries({
          queryKey: taskQueryKeys.subtasks(updatedTask.parentId),
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
    },
  })

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCategoryInput }) =>
      updateCategory(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() })
    },
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() })
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
