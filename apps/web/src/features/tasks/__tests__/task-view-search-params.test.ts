import { act, renderHook } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { useTaskViewSearchParams } from '../hooks/use-task-view-search-params'

function createWrapper(initialUrl: string = '/') {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(MemoryRouter, { initialEntries: [initialUrl] }, children)
}

describe('useTaskViewSearchParams', () => {
  it('parses valid search, status, priority, category, and sort parameters', () => {
    const initialUrl = '/tasks/inbox?q=report&status=todo&priority=high&category=cat-1&sort=due_asc'
    const { result } = renderHook(() => useTaskViewSearchParams(), {
      wrapper: createWrapper(initialUrl),
    })

    expect(result.current.params).toEqual({
      search: 'report',
      status: 'todo',
      priority: 'high',
      categoryId: 'cat-1',
      dueFrom: undefined,
      dueTo: undefined,
      sort: 'due_asc',
    })
  })

  it('handles "none" category for uncategorized tasks', () => {
    const initialUrl = '/tasks/inbox?category=none'
    const { result } = renderHook(() => useTaskViewSearchParams(), {
      wrapper: createWrapper(initialUrl),
    })

    expect(result.current.params.categoryId).toBeNull()
  })

  it('falls back to default for invalid status, priority, or sort', () => {
    const initialUrl = '/tasks/inbox?status=invalid_status&priority=urgent&sort=random_sort'
    const { result } = renderHook(() => useTaskViewSearchParams(), {
      wrapper: createWrapper(initialUrl),
    })

    expect(result.current.params.status).toBeUndefined()
    expect(result.current.params.priority).toBeUndefined()
    expect(result.current.params.sort).toBe('default')
  })

  it('serializes updated parameters back into URL search params', () => {
    const { result } = renderHook(() => useTaskViewSearchParams(), {
      wrapper: createWrapper('/tasks/inbox'),
    })

    act(() => {
      result.current.setParams({
        search: 'quarterly review',
        priority: 'high',
        categoryId: null, // uncategorized
        sort: 'priority',
      })
    })

    expect(result.current.params.search).toBe('quarterly review')
    expect(result.current.params.priority).toBe('high')
    expect(result.current.params.categoryId).toBeNull()
    expect(result.current.params.sort).toBe('priority')
  })

  it('clears filters while preserving search query and sort', () => {
    const initialUrl = '/tasks/inbox?q=important&priority=high&category=work&sort=created_desc'
    const { result } = renderHook(() => useTaskViewSearchParams(), {
      wrapper: createWrapper(initialUrl),
    })

    act(() => {
      result.current.clearFilters()
    })

    expect(result.current.params.search).toBe('important')
    expect(result.current.params.sort).toBe('created_desc')
    expect(result.current.params.priority).toBeUndefined()
    expect(result.current.params.categoryId).toBeUndefined()
  })
})
