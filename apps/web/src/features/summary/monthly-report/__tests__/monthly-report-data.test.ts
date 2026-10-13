import { describe, it, expect } from 'vitest'
import {
  dateToExcelSerial,
  mapStatusToReportText,
  mapTasksToReportData,
} from '../monthly-report-data'
import { calculateReportRange } from '../monthly-task-query'
import type { Task, Category } from '../../../tasks/types'
import type { UserProfile } from '@tabdo/types'

describe('monthly-report-data', () => {
  const timeZone = 'Asia/Ho_Chi_Minh'
  const range = calculateReportRange(
    { type: 'monthly', monthStr: '2026-10' },
    timeZone
  )

  describe('dateToExcelSerial', () => {
    it('calculates expected Excel date serial for 2026-10-15', () => {
      // 2026-10-15 in Excel 1900 system:
      // (2026-10-15 UTC - 1899-12-30 UTC) in days = 46310
      const date = new Date('2026-10-15T09:00:00+07:00')
      const serial = dateToExcelSerial(date, timeZone)
      expect(serial).toBe(46310)
    })
  })

  describe('mapStatusToReportText', () => {
    it('maps statuses correctly without speculating overdue', () => {
      expect(mapStatusToReportText('done')).toBe('Hoàn thành')
      expect(mapStatusToReportText('in_progress')).toBe('Đang thực hiện')
      expect(mapStatusToReportText('todo')).toBe('Chưa thực hiện')
      expect(mapStatusToReportText('unknown')).toBe('Chưa thực hiện')
    })
  })

  describe('mapTasksToReportData', () => {
    const mockCategories: Category[] = [
      {
        id: 'cat-hc',
        userId: 'u1',
        name: 'Hành chính',
        icon: null,
        color: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'cat-ns',
        userId: 'u1',
        name: 'Nhân sự',
        icon: null,
        color: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ]

    const mockProfile: UserProfile = {
      id: 'u1',
      displayName: 'Hoàng Mai',
      role: 'user',
      isActive: true,
      timezone: timeZone,
      mustChangePassword: false,
      locale: 'vi',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }

    it('maps 0 tasks properly and leaves fields blank', () => {
      const result = mapTasksToReportData({
        selectedTasks: [],
        categories: mockCategories,
        profile: mockProfile,
        range,
        now: new Date('2026-10-31T10:00:00+07:00'),
      })

      expect(result.reporterName).toBe(': Hoàng Mai')
      expect(result.reportDateText).toBe(': 31/10/2026')
      expect(result.periodText).toBe(
        ': 10/2026 (Thời gian thực hiện từ 01/10/2026 - 31/10/2026)'
      )
      expect(result.departmentText).toBe('')
      expect(result.jobTitleText).toBe('')
      expect(result.items).toHaveLength(0)
      expect(result.categories).toHaveLength(0)
    })

    it('maps 1 task with date serial and status', () => {
      const task: Task = {
        id: 't-1',
        userId: 'u1',
        categoryId: 'cat-hc',
        parentId: null,
        title: 'Mua sắm văn phòng phẩm',
        description: 'Bút, giấy, mực',
        status: 'done',
        priority: 'medium',
        dueDateKind: 'date_only',
        startAt: null,
        dueAt: '2026-10-15T16:59:59.999Z', // In ICT: 2026-10-15 23:59:59
        sourceUrl: null,
        completedAt: '2026-10-14T10:00:00Z',
        recurrenceRule: null,
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-14T10:00:00Z',
      }

      const result = mapTasksToReportData({
        selectedTasks: [task],
        categories: mockCategories,
        profile: mockProfile,
        range,
      })

      expect(result.items).toHaveLength(1)
      expect(result.items[0].title).toBe('Mua sắm văn phòng phẩm')
      expect(result.items[0].categoryName).toBe('Hành chính')
      expect(result.items[0].statusText).toBe('Hoàn thành')
      expect(result.items[0].dueAtDateSerial).toBe(46310)
      expect(result.items[0].dueAtDisplay).toBe('15/10/2026')
      expect(result.categories).toEqual(['Hành chính'])
    })

    it('maps multiple tasks and extracts unique categories in stable order', () => {
      const tasks: Task[] = [
        {
          id: 't-1',
          userId: 'u1',
          categoryId: 'cat-ns',
          parentId: null,
          title: 'Tuyển dụng Tester',
          description: null,
          status: 'in_progress',
          priority: 'high',
          dueDateKind: 'date_only',
          startAt: null,
          dueAt: null,
          sourceUrl: null,
          completedAt: null,
          recurrenceRule: null,
          createdAt: '2026-10-02T00:00:00Z',
          updatedAt: '2026-10-02T00:00:00Z',
        },
        {
          id: 't-2',
          userId: 'u1',
          categoryId: 'cat-hc',
          parentId: null,
          title: 'Kiểm kê tài sản',
          description: null,
          status: 'todo',
          priority: 'low',
          dueDateKind: 'date_only',
          startAt: null,
          dueAt: null,
          sourceUrl: null,
          completedAt: null,
          recurrenceRule: null,
          createdAt: '2026-10-03T00:00:00Z',
          updatedAt: '2026-10-03T00:00:00Z',
        },
        {
          id: 't-3',
          userId: 'u1',
          categoryId: null, // No category
          parentId: null,
          title: 'Việc đột xuất không nhóm',
          description: null,
          status: 'done',
          priority: 'medium',
          dueDateKind: 'date_only',
          startAt: null,
          dueAt: null,
          sourceUrl: null,
          completedAt: null,
          recurrenceRule: null,
          createdAt: '2026-10-04T00:00:00Z',
          updatedAt: '2026-10-04T00:00:00Z',
        },
        {
          id: 't-4',
          userId: 'u1',
          categoryId: 'cat-ns',
          parentId: null,
          title: 'Đào tạo nhân viên mới',
          description: null,
          status: 'done',
          priority: 'medium',
          dueDateKind: 'date_only',
          startAt: null,
          dueAt: null,
          sourceUrl: null,
          completedAt: null,
          recurrenceRule: null,
          createdAt: '2026-10-05T00:00:00Z',
          updatedAt: '2026-10-05T00:00:00Z',
        },
      ]

      const result = mapTasksToReportData({
        selectedTasks: tasks,
        categories: mockCategories,
        profile: mockProfile,
        range,
      })

      expect(result.items).toHaveLength(4)
      expect(result.items[2].categoryName).toBe('Không phân loại')
      // Unique categories order of appearance: Nhân sự, Hành chính, Không phân loại
      expect(result.categories).toEqual(['Nhân sự', 'Hành chính', 'Không phân loại'])
    })
  })
})
