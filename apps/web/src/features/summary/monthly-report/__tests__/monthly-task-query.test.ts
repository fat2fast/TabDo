import { describe, it, expect, vi } from 'vitest'
import {
  calculateReportRange,
  fetchMonthlyReportCandidateTasks,
} from '../monthly-task-query'
import type { TaskRow, CategoryRow } from '../../../tasks/types'

describe('monthly-task-query', () => {
  describe('calculateReportRange', () => {
    it('calculates monthly range correctly for Asia/Ho_Chi_Minh', () => {
      const range = calculateReportRange(
        { type: 'monthly', monthStr: '2026-10' },
        'Asia/Ho_Chi_Minh'
      )

      expect(range.type).toBe('monthly')
      expect(range.displayPeriod).toBe(
        ': 10/2026 (Thời gian thực hiện từ 01/10/2026 - 31/10/2026)'
      )
      expect(range.fileSlug).toBe('thang-10-2026')
      // 2026-10-01 00:00:00 ICT = 2026-09-30 17:00:00 UTC
      expect(range.startAt).toBe('2026-09-30T17:00:00.000Z')
      // 2026-11-01 00:00:00 ICT = 2026-10-31 17:00:00 UTC
      expect(range.endAt).toBe('2026-10-31T17:00:00.000Z')
    })

    it('calculates custom date range correctly', () => {
      const range = calculateReportRange(
        {
          type: 'custom',
          startDateStr: '2026-10-05',
          endDateStr: '2026-10-20',
        },
        'Asia/Ho_Chi_Minh'
      )

      expect(range.type).toBe('custom')
      expect(range.displayPeriod).toBe(
        ': (Thời gian thực hiện từ 05/10/2026 - 20/10/2026)'
      )
      expect(range.fileSlug).toBe('05-10-2026_20-10-2026')
      // 2026-10-05 00:00:00 ICT = 2026-10-04 17:00:00 UTC
      expect(range.startAt).toBe('2026-10-04T17:00:00.000Z')
      // Next day after 2026-10-20 is 2026-10-21 00:00:00 ICT = 2026-10-20 17:00:00 UTC
      expect(range.endAt).toBe('2026-10-20T17:00:00.000Z')
    })

    it('calculates quarterly range correctly', () => {
      const range = calculateReportRange(
        {
          type: 'quarterly',
          year: 2026,
          quarter: 3,
        },
        'Asia/Ho_Chi_Minh'
      )

      expect(range.type).toBe('quarterly')
      expect(range.displayPeriod).toBe(
        ': Quý 3/2026 (Thời gian thực hiện từ 01/07/2026 - 30/09/2026)'
      )
      expect(range.fileSlug).toBe('quy-3-2026')
      // 2026-07-01 00:00:00 ICT = 2026-06-30 17:00:00 UTC
      expect(range.startAt).toBe('2026-06-30T17:00:00.000Z')
      // 2026-10-01 00:00:00 ICT = 2026-09-30 17:00:00 UTC
      expect(range.endAt).toBe('2026-09-30T17:00:00.000Z')
    })

    it('throws error for invalid month format or dates', () => {
      expect(() =>
        calculateReportRange({ type: 'monthly', monthStr: 'invalid' }, 'UTC')
      ).toThrow('Invalid month format')

      expect(() =>
        calculateReportRange(
          { type: 'custom', startDateStr: '2026-10-20', endDateStr: '2026-10-05' },
          'UTC'
        )
      ).toThrow('End date must be on or after start date')
    })
  })

  describe('fetchMonthlyReportCandidateTasks', () => {
    function createMockClient(options: {
      categories?: CategoryRow[]
      dueRows?: TaskRow[]
      completedRows?: TaskRow[]
      createdRows?: TaskRow[]
      startRows?: TaskRow[]
      overlapRows?: TaskRow[]
      errorOnPage?: boolean
    }) {
      const categories = options.categories ?? []
      const dueRows = options.dueRows ?? []
      const completedRows = options.completedRows ?? []
      const createdRows = options.createdRows ?? []
      const startRows = options.startRows ?? []
      const overlapRows = options.overlapRows ?? []

      const client = {
        from: vi.fn((table: string) => {
          if (table === 'categories') {
            return {
              select: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              range: vi.fn((from: number, to: number) => {
                const data = categories.slice(from, to + 1)
                return Promise.resolve({ data, error: null })
              }),
            }
          }

          if (table === 'tasks') {
            let activeDataset: TaskRow[] = []
            let filterField = ''
            const builder: any = {
              select: vi.fn(() => builder),
              is: vi.fn(() => builder),
              gte: vi.fn((field: string) => {
                filterField = field
                if (field === 'due_at') activeDataset = dueRows
                else if (field === 'completed_at') activeDataset = completedRows
                else if (field === 'created_at') activeDataset = createdRows
                else if (field === 'start_at') activeDataset = startRows
                return builder
              }),
              lt: vi.fn((field: string) => {
                if (field === 'start_at') {
                  activeDataset = overlapRows
                }
                return builder
              }),
              order: vi.fn(() => builder),
              range: vi.fn((from: number, to: number) => {
                if (options.errorOnPage) {
                  return Promise.resolve({
                    data: null,
                    error: new Error('Simulated network error'),
                  })
                }
                const data = activeDataset.slice(from, to + 1)
                return Promise.resolve({ data, error: null })
              }),
            }
            return builder
          }

          throw new Error(`Unexpected table ${table}`)
        }),
      }

      return client as any
    }

    const sampleRange = calculateReportRange(
      { type: 'monthly', monthStr: '2026-10' },
      'Asia/Ho_Chi_Minh'
    )

    it('fetches candidates, resolves categories, and filters deleted tasks', async () => {
      const mockCategories: CategoryRow[] = [
        {
          id: 'cat-1',
          user_id: 'user-1',
          name: 'Hành chính',
          icon: null,
          color: null,
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ]

      const task1: TaskRow = {
        id: 'task-1',
        user_id: 'user-1',
        category_id: 'cat-1',
        parent_id: null,
        title: 'Task Due in October',
        description: null,
        status: 'todo',
        priority: 'medium',
        due_date_kind: 'date_only',
        start_at: null,
        due_at: '2026-10-10T10:00:00Z',
        source_url: null,
        completed_at: null,
        recurrence_rule: null,
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      }

      const task2Deleted: TaskRow = {
        id: 'task-2',
        user_id: 'user-1',
        category_id: 'cat-1',
        parent_id: null,
        title: 'Deleted Task',
        description: null,
        status: 'done',
        priority: 'high',
        due_date_kind: 'date_only',
        start_at: null,
        due_at: '2026-10-12T10:00:00Z',
        source_url: null,
        completed_at: null,
        recurrence_rule: null,
        deleted_at: '2026-10-13T00:00:00Z',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      }

      const mockClient = createMockClient({
        categories: mockCategories,
        dueRows: [task1, task2Deleted],
      })

      const result = await fetchMonthlyReportCandidateTasks({
        client: mockClient,
        range: sampleRange,
      })

      expect(result.candidates).toHaveLength(1)
      expect(result.candidates[0].task.id).toBe('task-1')
      expect(result.candidates[0].categoryName).toBe('Hành chính')
    })

    it('deduplicates tasks that match multiple criteria', async () => {
      const taskSame: TaskRow = {
        id: 'task-dup',
        user_id: 'user-1',
        category_id: null,
        parent_id: null,
        title: 'Task Created and Completed in Month',
        description: null,
        status: 'done',
        priority: 'medium',
        due_date_kind: 'date_only',
        start_at: null,
        due_at: null,
        source_url: null,
        completed_at: '2026-10-15T00:00:00Z',
        recurrence_rule: null,
        created_at: '2026-10-02T00:00:00Z',
        updated_at: '2026-10-15T00:00:00Z',
      }

      const mockClient = createMockClient({
        createdRows: [taskSame],
        completedRows: [taskSame],
      })

      const result = await fetchMonthlyReportCandidateTasks({
        client: mockClient,
        range: sampleRange,
      })

      expect(result.candidates).toHaveLength(1)
      expect(result.candidates[0].task.id).toBe('task-dup')
      expect(result.candidates[0].categoryName).toBe('Không phân loại')
    })

    it('handles pagination > 500 records properly', async () => {
      const manyTasks: TaskRow[] = []
      for (let i = 1; i <= 550; i++) {
        manyTasks.push({
          id: `task-${String(i).padStart(4, '0')}`,
          user_id: 'user-1',
          category_id: null,
          parent_id: null,
          title: `Task ${i}`,
          description: null,
          status: 'todo',
          priority: 'medium',
          due_date_kind: 'date_only',
          start_at: null,
          due_at: '2026-10-10T00:00:00Z',
          source_url: null,
          completed_at: null,
          recurrence_rule: null,
          created_at: '2026-10-01T00:00:00Z',
          updated_at: '2026-10-01T00:00:00Z',
        })
      }

      const mockClient = createMockClient({
        dueRows: manyTasks,
      })

      const result = await fetchMonthlyReportCandidateTasks({
        client: mockClient,
        range: sampleRange,
      })

      expect(result.candidates).toHaveLength(550)
    })

    it('throws error clearly if any page query fails', async () => {
      const mockClient = createMockClient({
        errorOnPage: true,
      })

      await expect(
        fetchMonthlyReportCandidateTasks({
          client: mockClient,
          range: sampleRange,
        })
      ).rejects.toThrow('Simulated network error')
    })
  })
})
