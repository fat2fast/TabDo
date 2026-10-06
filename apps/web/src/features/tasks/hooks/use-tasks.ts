import { useQuery } from '@tanstack/react-query'
import {
  getCategoryRelatedTasks,
  getSiblingTasks,
  getSubtasks,
  getTaskById,
  getTaskList,
  getTasksByIds,
  getSchedulableTasks,
  searchTasksCandidate,
} from '../api/tasks'
import { taskQueryKeys } from '../query-keys'
import type { TaskListQueryInput } from '../types'

export function useTaskList(input: TaskListQueryInput) {
  return useQuery({
    queryKey: taskQueryKeys.list(input),
    queryFn: () => getTaskList(input),
  })
}

export function useTaskDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: taskQueryKeys.detail(id || ''),
    queryFn: () => getTaskById(id!),
    enabled: Boolean(id),
  })
}

export function useSubtasks(parentId: string | null | undefined) {
  return useQuery({
    queryKey: taskQueryKeys.subtasks(parentId || ''),
    queryFn: () => getSubtasks(parentId!),
    enabled: Boolean(parentId),
  })
}

export function useLinkedTasks(ids: string[]) {
  return useQuery({
    queryKey: taskQueryKeys.linked(ids),
    queryFn: () => getTasksByIds(ids),
    enabled: ids.length > 0,
  })
}

export function useSiblingTasks(parentId: string | null | undefined, currentTaskId: string) {
  return useQuery({
    queryKey: taskQueryKeys.sibling(parentId || '', currentTaskId),
    queryFn: () => getSiblingTasks(parentId!, currentTaskId),
    enabled: Boolean(parentId),
  })
}

export function useCategoryRelatedTasks(categoryId: string | null | undefined, currentTaskId: string) {
  return useQuery({
    queryKey: taskQueryKeys.categoryRelated(categoryId || '', currentTaskId),
    queryFn: () => getCategoryRelatedTasks(categoryId!, currentTaskId),
    enabled: Boolean(categoryId),
  })
}

export function useTaskCandidates(currentTaskId: string, query: string, enabled = true) {
  return useQuery({
    queryKey: taskQueryKeys.candidates(currentTaskId, query),
    queryFn: () => searchTasksCandidate(query, currentTaskId),
    enabled,
  })
}

export function useSchedulableTasks(limit = 100) {
  return useQuery({
    queryKey: taskQueryKeys.schedulable(limit),
    queryFn: () => getSchedulableTasks(limit),
  })
}

