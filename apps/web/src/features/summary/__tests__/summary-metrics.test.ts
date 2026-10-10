import { describe, expect, it } from 'vitest'
import type { Category, ScheduleBlock, Task } from '@tabdo/types'
import { deriveSummary } from '../utils/summary-metrics'
import type { TaskActivitySummaryItem } from '../types'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? 'task-1',
    userId: 'user-1',
    categoryId: overrides.categoryId ?? null,
    parentId: null,
    title: overrides.title ?? 'Test Task',
    description: null,
    status: overrides.status ?? 'todo',
    priority: overrides.priority ?? 'medium',
    dueDateKind: overrides.dueDateKind ?? 'date_time',
    startAt: null,
    dueAt: overrides.dueAt ?? null,
    sourceUrl: null,
    completedAt: overrides.completedAt ?? null,
    recurrenceRule: null,
    recurrenceSeriesId: null,
    recurrenceParentId: null,
    recurrenceTimezone: null,
    recurrenceAnchorAt: null,
    createdAt: overrides.createdAt ?? '2026-10-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-10-01T00:00:00.000Z',
  }
}

describe('Summary Metrics Pure Derivation', () => {
  const timeZone = 'Asia/Ho_Chi_Minh'
  // 2026-10-10 local day in Asia/Ho_Chi_Minh is:
  // startAt: 2026-10-09T17:00:00.000Z
  // endAt:   2026-10-10T17:00:00.000Z

  it('handles zero tasks state with explicit empty rate', () => {
    const result = deriveSummary({
      period: 'daily',
      selectedDateStr: '2026-10-10',
      timeZone,
      referenceNow: new Date('2026-10-10T05:00:00.000Z'), // 12:00 ICT on that day
      tasksDueInPeriod: [],
      tasksCompletedInPeriod: [],
      scheduleBlocksInPeriod: [],
      completedActivitiesInPeriod: [],
      survivingActivityTasks: [],
      incompleteCutoffTasks: [],
      categories: [],
    })

    expect(result.period).toBe('daily')
    expect(result.plannedCount).toBe(0)
    expect(result.completedCount).toBe(0)
    expect(result.completedPlannedCount).toBe(0)
    expect(result.completionRate).toBeNull() // not NaN or 0 division
    expect(result.carryOverCount).toBe(0)
    expect(result.overdueCount).toBe(0)
    expect(result.completedTasks).toEqual([])
    expect(result.carryOverTasks).toEqual([])
    expect(result.overdueTasks).toEqual([])
  })

  it('deduplicates planned tasks that are both due and scheduled in period', () => {
    const task = makeTask({
      id: 'task-both',
      dueAt: '2026-10-10T03:00:00.000Z', // 10:00 ICT on Oct 10
    })

    const block: ScheduleBlock = {
      id: 'block-1',
      userId: 'user-1',
      taskId: 'task-both',
      title: 'Work on Task Both',
      startAt: '2026-10-10T02:00:00.000Z',
      endAt: '2026-10-10T04:00:00.000Z',
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    }

    const result = deriveSummary({
      period: 'daily',
      selectedDateStr: '2026-10-10',
      timeZone,
      referenceNow: new Date('2026-10-10T05:00:00.000Z'),
      tasksDueInPeriod: [task],
      tasksCompletedInPeriod: [],
      scheduleBlocksInPeriod: [{ ...block, task }],
      completedActivitiesInPeriod: [],
      survivingActivityTasks: [],
      incompleteCutoffTasks: [],
      categories: [],
    })

    expect(result.plannedCount).toBe(1)
  })

  it('ignores unlinked schedule blocks without taskId', () => {
    const unlinkedBlock: ScheduleBlock = {
      id: 'block-unlinked',
      userId: 'user-1',
      taskId: null,
      title: 'Free reading block',
      startAt: '2026-10-10T02:00:00.000Z',
      endAt: '2026-10-10T04:00:00.000Z',
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    }

    const result = deriveSummary({
      period: 'daily',
      selectedDateStr: '2026-10-10',
      timeZone,
      referenceNow: new Date('2026-10-10T05:00:00.000Z'),
      tasksDueInPeriod: [],
      tasksCompletedInPeriod: [],
      scheduleBlocksInPeriod: [unlinkedBlock],
      completedActivitiesInPeriod: [],
      survivingActivityTasks: [],
      incompleteCutoffTasks: [],
      categories: [],
    })

    expect(result.plannedCount).toBe(0)
  })

  it('includes task completed at local midnight boundary [startAt, endAt)', () => {
    // startAt is 2026-10-09T17:00:00.000Z (00:00:00 ICT)
    const taskAtExactStart = makeTask({
      id: 'task-start',
      status: 'done',
      completedAt: '2026-10-09T17:00:00.000Z',
    })

    // endAt is 2026-10-10T17:00:00.000Z (next day 00:00:00 ICT) -> should NOT be included
    const taskAtExactEnd = makeTask({
      id: 'task-end',
      status: 'done',
      completedAt: '2026-10-10T17:00:00.000Z',
    })

    const result = deriveSummary({
      period: 'daily',
      selectedDateStr: '2026-10-10',
      timeZone,
      referenceNow: new Date('2026-10-10T18:00:00.000Z'),
      tasksDueInPeriod: [],
      tasksCompletedInPeriod: [taskAtExactStart, taskAtExactEnd],
      scheduleBlocksInPeriod: [],
      completedActivitiesInPeriod: [],
      survivingActivityTasks: [],
      incompleteCutoffTasks: [],
      categories: [],
    })

    expect(result.completedCount).toBe(1)
    expect(result.completedTasks.map((t) => t.id)).toEqual(['task-start'])
  })

  it('includes surviving task with completion activity in period even if currently reopened', () => {
    // Task was completed in this period, but later reopened so current status is 'todo' and completed_at is null
    const reopenedTask = makeTask({
      id: 'task-reopened',
      status: 'todo',
      completedAt: null,
    })

    const activity: TaskActivitySummaryItem = {
      id: 'act-1',
      taskId: 'task-reopened',
      action: 'completed',
      createdAt: '2026-10-10T02:00:00.000Z',
    }

    const result = deriveSummary({
      period: 'daily',
      selectedDateStr: '2026-10-10',
      timeZone,
      referenceNow: new Date('2026-10-10T05:00:00.000Z'),
      tasksDueInPeriod: [],
      tasksCompletedInPeriod: [],
      scheduleBlocksInPeriod: [],
      completedActivitiesInPeriod: [activity],
      survivingActivityTasks: [reopenedTask],
      incompleteCutoffTasks: [],
      categories: [],
    })

    expect(result.completedCount).toBe(1)
    expect(result.completedTasks[0].id).toBe('task-reopened')
  })

  it('handles unplanned completions without raising completion rate above 100%', () => {
    // Planned task A
    const plannedTask = makeTask({
      id: 'task-planned',
      dueAt: '2026-10-10T02:00:00.000Z',
      status: 'done',
      completedAt: '2026-10-10T03:00:00.000Z',
    })

    // Unplanned task B (not due or scheduled today, but completed today)
    const unplannedTask = makeTask({
      id: 'task-unplanned',
      status: 'done',
      completedAt: '2026-10-10T04:00:00.000Z',
    })

    const result = deriveSummary({
      period: 'daily',
      selectedDateStr: '2026-10-10',
      timeZone,
      referenceNow: new Date('2026-10-10T05:00:00.000Z'),
      tasksDueInPeriod: [plannedTask],
      tasksCompletedInPeriod: [plannedTask, unplannedTask],
      scheduleBlocksInPeriod: [],
      completedActivitiesInPeriod: [],
      survivingActivityTasks: [],
      incompleteCutoffTasks: [],
      categories: [],
    })

    expect(result.plannedCount).toBe(1)
    expect(result.completedCount).toBe(2)
    expect(result.completedPlannedCount).toBe(1)
    expect(result.completionRate).toBe(1.0) // 100%, capped at 1.0
  })

  it('determines carry over tasks correctly', () => {
    const doneTask = makeTask({
      id: 'task-done',
      dueAt: '2026-10-10T02:00:00.000Z',
      status: 'done',
      completedAt: '2026-10-10T03:00:00.000Z',
    })

    const pendingTask = makeTask({
      id: 'task-pending',
      dueAt: '2026-10-10T04:00:00.000Z',
      status: 'in_progress',
    })

    const result = deriveSummary({
      period: 'daily',
      selectedDateStr: '2026-10-10',
      timeZone,
      referenceNow: new Date('2026-10-10T05:00:00.000Z'),
      tasksDueInPeriod: [doneTask, pendingTask],
      tasksCompletedInPeriod: [doneTask],
      scheduleBlocksInPeriod: [],
      completedActivitiesInPeriod: [],
      survivingActivityTasks: [],
      incompleteCutoffTasks: [],
      categories: [],
    })

    expect(result.carryOverCount).toBe(1)
    expect(result.carryOverTasks.map((t) => t.id)).toEqual(['task-pending'])
  })

  it('evaluates overdue cutoff based on current period vs historical period', () => {
    const taskDue9am = makeTask({
      id: 'task-9am',
      dueAt: '2026-10-10T02:00:00.000Z', // 09:00 ICT
      createdAt: '2026-10-09T00:00:00.000Z',
      status: 'todo',
    })
    const taskDue4pm = makeTask({
      id: 'task-4pm',
      dueAt: '2026-10-10T09:00:00.000Z', // 16:00 ICT
      createdAt: '2026-10-09T00:00:00.000Z',
      status: 'todo',
    })

    // At 12:00 ICT (05:00 UTC), taskDue9am is overdue, but taskDue4pm is not yet overdue
    const currentResult = deriveSummary({
      period: 'daily',
      selectedDateStr: '2026-10-10',
      timeZone,
      referenceNow: new Date('2026-10-10T05:00:00.000Z'), // current day, 12:00 ICT
      tasksDueInPeriod: [taskDue9am, taskDue4pm],
      tasksCompletedInPeriod: [],
      scheduleBlocksInPeriod: [],
      completedActivitiesInPeriod: [],
      survivingActivityTasks: [],
      incompleteCutoffTasks: [taskDue9am, taskDue4pm],
      categories: [],
    })

    expect(currentResult.overdueCount).toBe(1)
    expect(currentResult.overdueTasks.map((t) => t.id)).toEqual(['task-9am'])

    // For a historical day, cutoff is period end (17:00 UTC), so both are overdue
    const historicalResult = deriveSummary({
      period: 'daily',
      selectedDateStr: '2026-10-10',
      timeZone,
      referenceNow: new Date('2026-10-12T00:00:00.000Z'), // future reference
      tasksDueInPeriod: [taskDue9am, taskDue4pm],
      tasksCompletedInPeriod: [],
      scheduleBlocksInPeriod: [],
      completedActivitiesInPeriod: [],
      survivingActivityTasks: [],
      incompleteCutoffTasks: [taskDue9am, taskDue4pm],
      categories: [],
    })

    expect(historicalResult.overdueCount).toBe(2)
    expect(historicalResult.overdueTasks.map((t) => t.id)).toEqual(['task-9am', 'task-4pm'])
  })

  it('categorizes completed tasks and handles null/deleted categories as Uncategorized', () => {
    const catWork: Category = {
      id: 'cat-work',
      userId: 'user-1',
      name: 'Work',
      icon: null,
      color: '#3b82f6',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    }

    const t1 = makeTask({
      id: 't-1',
      categoryId: 'cat-work',
      status: 'done',
      completedAt: '2026-10-06T02:00:00.000Z',
    })
    const t2 = makeTask({
      id: 't-2',
      categoryId: 'cat-deleted', // deleted category
      status: 'done',
      completedAt: '2026-10-07T02:00:00.000Z',
    })
    const t3 = makeTask({
      id: 't-3',
      categoryId: null, // uncategorized
      status: 'done',
      completedAt: '2026-10-08T02:00:00.000Z',
    })

    const weekly = deriveSummary({
      period: 'weekly',
      selectedDateStr: '2026-10-10', // Week of Oct 5 - Oct 11
      timeZone,
      referenceNow: new Date('2026-10-10T05:00:00.000Z'),
      tasksDueInPeriod: [],
      tasksCompletedInPeriod: [t1, t2, t3],
      scheduleBlocksInPeriod: [],
      completedActivitiesInPeriod: [],
      survivingActivityTasks: [],
      incompleteCutoffTasks: [],
      categories: [catWork], // only cat-work exists
    })

    expect(weekly.period).toBe('weekly')
    if (weekly.period === 'weekly') {
      expect(weekly.categoryBreakdown).toHaveLength(2)
      // Uncategorized has 2 tasks (t2 + t3), Work has 1 task
      const uncat = weekly.categoryBreakdown.find((c) => c.isUncategorized)
      const work = weekly.categoryBreakdown.find((c) => c.categoryId === 'cat-work')
      expect(uncat?.count).toBe(2)
      expect(work?.count).toBe(1)
    }
  })

  it('selects earliest tied day for most productive day in weekly summary', () => {
    // Week of Oct 5 (Mon) to Oct 11 (Sun)
    // 2 completions on Monday (Oct 5), 2 completions on Wednesday (Oct 7)
    // Earliest tie should be Monday!
    const mon1 = makeTask({ id: 'm1', status: 'done', completedAt: '2026-10-05T02:00:00.000Z' })
    const mon2 = makeTask({ id: 'm2', status: 'done', completedAt: '2026-10-05T04:00:00.000Z' })
    const wed1 = makeTask({ id: 'w1', status: 'done', completedAt: '2026-10-07T02:00:00.000Z' })
    const wed2 = makeTask({ id: 'w2', status: 'done', completedAt: '2026-10-07T04:00:00.000Z' })

    const weekly = deriveSummary({
      period: 'weekly',
      selectedDateStr: '2026-10-10',
      timeZone,
      referenceNow: new Date('2026-10-10T05:00:00.000Z'),
      tasksDueInPeriod: [],
      tasksCompletedInPeriod: [mon1, mon2, wed1, wed2],
      scheduleBlocksInPeriod: [],
      completedActivitiesInPeriod: [],
      survivingActivityTasks: [],
      incompleteCutoffTasks: [],
      categories: [],
    })

    if (weekly.period === 'weekly') {
      expect(weekly.mostProductiveDay).not.toBeNull()
      expect(weekly.mostProductiveDay?.dateStr).toBe('2026-10-05') // Monday
      expect(weekly.mostProductiveDay?.dayOfWeek).toBe(1)
      expect(weekly.mostProductiveDay?.count).toBe(2)
      expect(weekly.dailyBreakdown).toHaveLength(7)
      expect(weekly.dailyBreakdown[0].count).toBe(2) // Mon
      expect(weekly.dailyBreakdown[2].count).toBe(2) // Wed
      expect(weekly.dailyBreakdown[1].count).toBe(0) // Tue
    }
  })

  it('computes comparison vs previous week in percentage points', () => {
    // This week: planned = 10, completed planned = 8 -> rate = 80% (0.8)
    // Previous week: planned = 10, completed planned = 7 -> rate = 70% (0.7)
    // Diff rate in percentage points: +10 percentage points
    const tasks: Task[] = []
    for (let i = 0; i < 10; i++) {
      tasks.push(
        makeTask({
          id: `task-${i}`,
          dueAt: '2026-10-06T02:00:00.000Z',
          status: i < 8 ? 'done' : 'todo',
          completedAt: i < 8 ? '2026-10-06T03:00:00.000Z' : null,
        })
      )
    }

    const weekly = deriveSummary({
      period: 'weekly',
      selectedDateStr: '2026-10-10',
      timeZone,
      referenceNow: new Date('2026-10-10T05:00:00.000Z'),
      tasksDueInPeriod: tasks,
      tasksCompletedInPeriod: tasks.filter((t) => t.status === 'done'),
      scheduleBlocksInPeriod: [],
      completedActivitiesInPeriod: [],
      survivingActivityTasks: [],
      incompleteCutoffTasks: [],
      categories: [],
      previousWeekMetrics: {
        plannedCount: 10,
        completedCount: 7,
        completedPlannedCount: 7,
        completionRate: 0.7,
      },
    })

    if (weekly.period === 'weekly') {
      expect(weekly.completionRate).toBe(0.8)
      expect(weekly.comparisonVsPreviousWeek).toEqual({
        previousCompletedCount: 7,
        diffCompletedCount: 1, // 8 - 7
        previousRate: 0.7,
        rateDiffPercentagePoints: 10, // +10 percentage points
      })
    }
  })
})
