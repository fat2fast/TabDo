import type { TaskListQueryInput } from './types'

export const taskQueryKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskQueryKeys.all, 'list'] as const,
  list: (input: Omit<TaskListQueryInput, 'now'>) =>
    [
      ...taskQueryKeys.lists(),
      {
        view: input.view,
        search: input.search?.trim() || '',
        status: input.status,
        priority: input.priority,
        categoryId: input.categoryId,
        dueFrom: input.dueFrom,
        dueTo: input.dueTo,
        sort: input.sort || 'default',
        limit: input.limit || 50,
        timeZone: input.timeZone,
      },
    ] as const,
  details: () => [...taskQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskQueryKeys.details(), id] as const,
  subtasks: (parentId: string) => [...taskQueryKeys.all, 'subtasks', parentId] as const,
  linked: (ids: string[]) => [...taskQueryKeys.all, 'linked', ids.slice().sort().join(',')] as const,
  sibling: (parentId: string, currentTaskId: string) =>
    [...taskQueryKeys.all, 'sibling', parentId, currentTaskId] as const,
  categoryRelated: (categoryId: string, currentTaskId: string) =>
    [...taskQueryKeys.all, 'categoryRelated', categoryId, currentTaskId] as const,
  candidates: (currentTaskId: string, query: string) =>
    [...taskQueryKeys.all, 'candidates', currentTaskId, query] as const,
}

export const categoryQueryKeys = {
  all: ['categories'] as const,
  list: () => [...categoryQueryKeys.all, 'list'] as const,
}
