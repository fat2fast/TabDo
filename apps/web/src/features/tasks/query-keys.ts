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
        completedFrom: input.completedFrom,
        completedTo: input.completedTo,
        sort: input.sort || 'default',
        limit: input.limit || 50,
        scope: input.scope,
        timeZone: input.timeZone,
      },
    ] as const,
  boards: () => [...taskQueryKeys.all, 'board'] as const,
  boardLane: (input: Omit<import('./types').TaskBoardLaneQueryInput, 'now'>) =>
    [
      ...taskQueryKeys.boards(),
      'lane',
      {
        view: input.view,
        search: input.search?.trim() || '',
        priority: input.priority,
        categoryId: input.categoryId,
        dueFrom: input.dueFrom,
        dueTo: input.dueTo,
        completedFrom: input.completedFrom,
        completedTo: input.completedTo,
        sort: input.sort || 'default',
        scope: input.scope,
        timeZone: input.timeZone,
        statusFilter: input.statusFilter,
        lane: input.lane,
        pageSize: input.pageSize || 30,
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
  schedulable: (limit = 100) =>
    [...taskQueryKeys.all, 'schedulable', limit] as const,
  trash: (search?: string) =>
    [...taskQueryKeys.all, 'trash', search || ''] as const,
  attachments: (taskId: string) =>
    [...taskQueryKeys.all, 'attachments', taskId] as const,
}

export const categoryQueryKeys = {
  all: ['categories'] as const,
  list: () => [...categoryQueryKeys.all, 'list'] as const,
}
