import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { TaskPriority, TaskSortOption, TaskStatus } from '../types'

export interface TaskViewSearchParams {
  search: string
  status: TaskStatus | undefined
  priority: TaskPriority | undefined
  categoryId: string | null | undefined
  dueFrom: string | undefined
  dueTo: string | undefined
  sort: TaskSortOption
  scope: string | undefined
}

const VALID_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done']
const VALID_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high']
const VALID_SORTS: TaskSortOption[] = [
  'default',
  'due_asc',
  'due_desc',
  'priority',
  'created_desc',
  'updated_desc',
]

export function useTaskViewSearchParams() {
  const [searchParams, setSearchParams] = useSearchParams()

  const params: TaskViewSearchParams = useMemo(() => {
    const rawSearch = searchParams.get('q') || searchParams.get('search') || ''
    const rawStatus = searchParams.get('status')
    const rawPriority = searchParams.get('priority')
    const rawCategory = searchParams.get('category')
    const rawDueFrom = searchParams.get('dueFrom')
    const rawDueTo = searchParams.get('dueTo')
    const rawSort = searchParams.get('sort')
    const rawScope = searchParams.get('scope') || undefined

    const status = VALID_STATUSES.includes(rawStatus as TaskStatus)
      ? (rawStatus as TaskStatus)
      : undefined

    const priority = VALID_PRIORITIES.includes(rawPriority as TaskPriority)
      ? (rawPriority as TaskPriority)
      : undefined

    let categoryId: string | null | undefined = undefined
    if (rawCategory === 'none') {
      categoryId = null
    } else if (rawCategory) {
      categoryId = rawCategory
    }

    const sort = VALID_SORTS.includes(rawSort as TaskSortOption)
      ? (rawSort as TaskSortOption)
      : 'default'

    return {
      search: rawSearch.trim(),
      status,
      priority,
      categoryId,
      dueFrom: rawDueFrom || undefined,
      dueTo: rawDueTo || undefined,
      sort,
      scope: rawScope,
    }
  }, [searchParams])

  const setParams = (newParams: Partial<TaskViewSearchParams>) => {
    const updated = new URLSearchParams(searchParams)

    if ('search' in newParams) {
      const q = newParams.search?.trim()
      if (q) updated.set('q', q)
      else {
        updated.delete('q')
        updated.delete('search')
      }
    }

    if ('status' in newParams) {
      if (newParams.status && VALID_STATUSES.includes(newParams.status)) {
        updated.set('status', newParams.status)
      } else {
        updated.delete('status')
      }
    }

    if ('priority' in newParams) {
      if (newParams.priority && VALID_PRIORITIES.includes(newParams.priority)) {
        updated.set('priority', newParams.priority)
      } else {
        updated.delete('priority')
      }
    }

    if ('categoryId' in newParams) {
      if (newParams.categoryId === null) {
        updated.set('category', 'none')
      } else if (newParams.categoryId) {
        updated.set('category', newParams.categoryId)
      } else {
        updated.delete('category')
      }
    }

    if ('dueFrom' in newParams) {
      if (newParams.dueFrom) updated.set('dueFrom', newParams.dueFrom)
      else updated.delete('dueFrom')
    }

    if ('dueTo' in newParams) {
      if (newParams.dueTo) updated.set('dueTo', newParams.dueTo)
      else updated.delete('dueTo')
    }

    if ('sort' in newParams) {
      if (newParams.sort && newParams.sort !== 'default' && VALID_SORTS.includes(newParams.sort)) {
        updated.set('sort', newParams.sort)
      } else {
        updated.delete('sort')
      }
    }

    if ('scope' in newParams) {
      if (newParams.scope) updated.set('scope', newParams.scope)
      else updated.delete('scope')
    }

    setSearchParams(updated, { replace: true })
  }

  const clearFilters = () => {
    const updated = new URLSearchParams()
    // Retain sort and search if desired, or clear filters only
    const q = searchParams.get('q')
    const sort = searchParams.get('sort')
    if (q) updated.set('q', q)
    if (sort) updated.set('sort', sort)
    setSearchParams(updated, { replace: true })
  }

  return {
    params,
    setParams,
    clearFilters,
  }
}
