import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useScheduleBlockMutations } from '../../scheduling/hooks/use-schedule-block-mutations'
import { useTaskMutations } from '../../tasks/hooks/use-task-mutations'
import { summaryQueryKeys } from '../query-keys'

// Mock tasks and schedule API functions
vi.mock('../../tasks/api/tasks', () => ({
  createTask: vi.fn().mockResolvedValue({ id: 't-new', title: 'New Task' }),
  updateTask: vi.fn().mockResolvedValue({ id: 't-1', title: 'Updated Task' }),
  deleteTask: vi.fn().mockResolvedValue(undefined),
  completeTask: vi.fn().mockResolvedValue({
    completedTask: { id: 't-1', status: 'done' },
    nextTask: null,
  }),
  reopenTask: vi.fn().mockResolvedValue({ id: 't-1', status: 'todo' }),
}))

vi.mock('../../tasks/api/categories', () => ({
  createCategory: vi.fn().mockResolvedValue({ id: 'cat-new', name: 'New Cat' }),
  updateCategory: vi.fn().mockResolvedValue({ id: 'cat-1', name: 'Updated Cat' }),
  deleteCategory: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../scheduling/api/schedule-blocks', () => ({
  createScheduleBlock: vi.fn().mockResolvedValue({ id: 'sb-new', title: 'Block' }),
  updateScheduleBlock: vi.fn().mockResolvedValue({ id: 'sb-1', title: 'Updated Block' }),
  deleteScheduleBlock: vi.fn().mockResolvedValue(undefined),
}))

describe('Summary Cache and Query Keys', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    vi.clearAllMocks()
  })

  it('includes userId, timeZone, period, and dateStr in detail key for complete identity isolation', () => {
    const keyUser1 = summaryQueryKeys.detail(
      'user-1',
      'Asia/Ho_Chi_Minh',
      'daily',
      '2026-10-10'
    )
    const keyUser2 = summaryQueryKeys.detail(
      'user-2',
      'Asia/Ho_Chi_Minh',
      'daily',
      '2026-10-10'
    )
    const keyWeekly = summaryQueryKeys.detail(
      'user-1',
      'Asia/Ho_Chi_Minh',
      'weekly',
      '2026-10-10'
    )

    expect(keyUser1).toEqual([
      'summary',
      'user-1',
      'Asia/Ho_Chi_Minh',
      'daily',
      '2026-10-10',
    ])
    expect(keyUser2).toEqual([
      'summary',
      'user-2',
      'Asia/Ho_Chi_Minh',
      'daily',
      '2026-10-10',
    ])
    // Distinct users have distinct cache keys preventing cross-account data leakage
    expect(keyUser1).not.toEqual(keyUser2)
    // Daily and weekly summaries have distinct cache keys
    expect(keyUser1).not.toEqual(keyWeekly)
  })

  it('summaryQueryKeys.all matches the root prefix for bulk invalidation across all views and dates', () => {
    expect(summaryQueryKeys.all).toEqual(['summary'])
    const userDetailKey = summaryQueryKeys.detail(
      'user-1',
      'Asia/Ho_Chi_Minh',
      'daily',
      '2026-10-10'
    )
    expect(userDetailKey[0]).toBe(summaryQueryKeys.all[0])
  })

  it('invalidates summaryQueryKeys.all on task creation, completion, reopening, and category mutations', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useTaskMutations(), { wrapper })

    // 1. Create task
    await result.current.createTaskMutation.mutateAsync({ title: 'New Task' })
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: summaryQueryKeys.all })
    )

    // 2. Complete task
    invalidateSpy.mockClear()
    await result.current.completeTaskMutation.mutateAsync({
      id: 't-1',
      title: 'Task 1',
    } as any)
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: summaryQueryKeys.all })
    )

    // 3. Reopen task
    invalidateSpy.mockClear()
    await result.current.reopenTaskMutation.mutateAsync({
      id: 't-1',
      title: 'Task 1',
    } as any)
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: summaryQueryKeys.all })
    )

    // 4. Create category
    invalidateSpy.mockClear()
    await result.current.createCategoryMutation.mutateAsync({ name: 'Work' })
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: summaryQueryKeys.all })
    )
  })

  it('invalidates summaryQueryKeys.all on schedule block mutations', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useScheduleBlockMutations(), { wrapper })

    // 1. Create schedule block
    await result.current.createMutation.mutateAsync({
      title: 'Focus Block',
      startAt: '2026-10-10T02:00:00.000Z',
      endAt: '2026-10-10T04:00:00.000Z',
    })
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: summaryQueryKeys.all })
    )

    // 2. Update schedule block
    invalidateSpy.mockClear()
    await result.current.updateMutation.mutateAsync({
      id: 'sb-1',
      input: { title: 'Updated Block', previousUpdatedAt: '2026-10-09T00:00:00.000Z' },
    })
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: summaryQueryKeys.all })
    )

    // 3. Delete schedule block
    invalidateSpy.mockClear()
    await result.current.deleteMutation.mutateAsync({
      id: 'sb-1',
      previousUpdatedAt: '2026-10-09T00:00:00.000Z',
    })
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: summaryQueryKeys.all })
    )
  })
})
