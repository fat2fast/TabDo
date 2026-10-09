import { describe, expect, it } from 'vitest'
import { deriveDashboardSnapshot } from '../utils/dashboard-metrics'
import type { Task } from '../../tasks/types'
import type { ScheduleBlock } from '../../scheduling/types'

describe('deriveDashboardSnapshot', () => {
  const referenceNow = new Date('2026-10-09T10:00:00.000Z')
  const localStartIso = '2026-10-08T17:00:00.000Z' // e.g. 2026-10-09 00:00 in +07:00
  const nextLocalStartIso = '2026-10-09T17:00:00.000Z' // 2026-10-10 00:00 in +07:00
  const nextSevenDaysEndIso = '2026-10-16T17:00:00.000Z' // 2026-10-17 00:00 in +07:00

  const baseTask: Task = {
    id: 't-1',
    userId: 'u-1',
    title: 'Test task',
    status: 'todo',
    priority: 'medium',
    dueDateKind: 'date_time',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  }

  it('handles empty data with neutral 0% completion and no errors', () => {
    const snapshot = deriveDashboardSnapshot({
      incompleteTasks: [],
      completedTodayTasks: [],
      todayBlocks: [],
      referenceNow,
      localStartIso,
      nextLocalStartIso,
      nextSevenDaysEndIso,
    })

    expect(snapshot.metrics).toEqual({
      relevantCount: 0,
      completedCount: 0,
      remainingCount: 0,
      overdueCount: 0,
      completionPercentage: 0,
    })
    expect(snapshot.priorityTasks).toEqual([])
    expect(snapshot.overdueTasks).toEqual([])
    expect(snapshot.todaySchedule).toEqual([])
    expect(snapshot.upcomingTasks).toEqual([])
  })

  it('deduplicates tasks that are both due today and scheduled today', () => {
    const taskBoth: Task = {
      ...baseTask,
      id: 'task-both',
      title: 'Task due and scheduled today',
      dueAt: '2026-10-09T08:00:00.000Z', // due today
    }

    const block: ScheduleBlock & { task?: Task | null } = {
      id: 'b-1',
      userId: 'u-1',
      taskId: 'task-both',
      title: 'Timeblock for task',
      startAt: '2026-10-09T02:00:00.000Z',
      endAt: '2026-10-09T03:00:00.000Z',
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
      task: taskBoth,
    }

    const snapshot = deriveDashboardSnapshot({
      incompleteTasks: [taskBoth],
      completedTodayTasks: [],
      todayBlocks: [block],
      referenceNow,
      localStartIso,
      nextLocalStartIso,
      nextSevenDaysEndIso,
    })

    // Must appear only ONCE in relevantCount
    expect(snapshot.metrics.relevantCount).toBe(1)
    expect(snapshot.metrics.remainingCount).toBe(1)
    expect(snapshot.metrics.completedCount).toBe(0)
    expect(snapshot.metrics.completionPercentage).toBe(0)
    expect(snapshot.priorityTasks.length).toBe(1)
    expect(snapshot.todaySchedule.length).toBe(1)
    expect(snapshot.todaySchedule[0]?.taskTitle).toBe('Task due and scheduled today')
  })

  it('correctly calculates completed percentage when relevant tasks are completed', () => {
    const doneTask1: Task = {
      ...baseTask,
      id: 't-done-1',
      status: 'done',
      dueAt: '2026-10-09T05:00:00.000Z',
      completedAt: '2026-10-09T06:00:00.000Z',
    }

    const remainingTask1: Task = {
      ...baseTask,
      id: 't-remain-1',
      status: 'todo',
      dueAt: '2026-10-09T12:00:00.000Z',
    }

    const snapshot = deriveDashboardSnapshot({
      incompleteTasks: [remainingTask1],
      completedTodayTasks: [doneTask1],
      todayBlocks: [],
      referenceNow,
      localStartIso,
      nextLocalStartIso,
      nextSevenDaysEndIso,
    })

    expect(snapshot.metrics.relevantCount).toBe(2)
    expect(snapshot.metrics.completedCount).toBe(1)
    expect(snapshot.metrics.remainingCount).toBe(1)
    expect(snapshot.metrics.completionPercentage).toBe(50)
  })

  it('flags overdue tasks and puts overdue tasks at the top of priority tasks', () => {
    const overdueTask: Task = {
      ...baseTask,
      id: 't-overdue',
      title: 'Overdue task',
      priority: 'low',
      dueAt: '2026-10-09T07:00:00.000Z', // 3 hours before referenceNow (10:00)
    }

    const normalTask: Task = {
      ...baseTask,
      id: 't-normal',
      title: 'Later today task',
      priority: 'high',
      dueAt: '2026-10-09T14:00:00.000Z', // 4 hours after referenceNow
    }

    const snapshot = deriveDashboardSnapshot({
      incompleteTasks: [normalTask, overdueTask],
      completedTodayTasks: [],
      todayBlocks: [],
      referenceNow,
      localStartIso,
      nextLocalStartIso,
      nextSevenDaysEndIso,
    })

    expect(snapshot.metrics.overdueCount).toBe(1)
    expect(snapshot.overdueTasks.map((t) => t.id)).toEqual(['t-overdue'])
    // Overdue task comes before high priority non-overdue task
    expect(snapshot.priorityTasks[0]?.id).toBe('t-overdue')
    expect(snapshot.priorityTasks[1]?.id).toBe('t-normal')
  })

  it('filters upcoming tasks to only those in the next 7 complete days', () => {
    const upcomingTask: Task = {
      ...baseTask,
      id: 't-upcoming',
      title: 'Tomorrow task',
      dueAt: '2026-10-11T09:00:00.000Z', // between nextLocalStartIso and nextSevenDaysEndIso
    }

    const farFutureTask: Task = {
      ...baseTask,
      id: 't-far',
      title: 'Far future task',
      dueAt: '2026-10-25T09:00:00.000Z', // after nextSevenDaysEndIso
    }

    const todayTask: Task = {
      ...baseTask,
      id: 't-today',
      title: 'Today task',
      dueAt: '2026-10-09T12:00:00.000Z', // before nextLocalStartIso
    }

    const snapshot = deriveDashboardSnapshot({
      incompleteTasks: [upcomingTask, farFutureTask, todayTask],
      completedTodayTasks: [],
      todayBlocks: [],
      referenceNow,
      localStartIso,
      nextLocalStartIso,
      nextSevenDaysEndIso,
    })

    expect(snapshot.upcomingTasks.map((t) => t.id)).toEqual(['t-upcoming'])
  })

  it('excludes schedule blocks outside today local boundary', () => {
    const blockYesterday: ScheduleBlock = {
      id: 'b-yesterday',
      userId: 'u-1',
      taskId: null,
      title: 'Yesterday block',
      startAt: '2026-10-08T10:00:00.000Z',
      endAt: '2026-10-08T11:00:00.000Z',
      createdAt: '2026-10-08T00:00:00.000Z',
      updatedAt: '2026-10-08T00:00:00.000Z',
    }

    const blockToday: ScheduleBlock = {
      id: 'b-today',
      userId: 'u-1',
      taskId: null,
      title: 'Today block',
      startAt: '2026-10-09T02:00:00.000Z',
      endAt: '2026-10-09T03:00:00.000Z',
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    }

    const snapshot = deriveDashboardSnapshot({
      incompleteTasks: [],
      completedTodayTasks: [],
      todayBlocks: [blockYesterday, blockToday],
      referenceNow,
      localStartIso,
      nextLocalStartIso,
      nextSevenDaysEndIso,
    })

    expect(snapshot.todaySchedule.length).toBe(1)
    expect(snapshot.todaySchedule[0]?.id).toBe('b-today')
  })
})
