import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createReminder,
  deleteReminder,
  dismissReminder,
  getRemindersByTask,
  getUpcomingRemindersWeb,
  snoozeReminder,
  updateReminder,
} from '../api/reminders'
import { supabase } from '../../../lib/supabase'

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}))

describe('reminder-api', () => {
  const mockUser = { id: 'user-rem-123' }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser as any },
      error: null,
    })
  })

  describe('getRemindersByTask', () => {
    it('queries reminders for task ordered by effective_at', async () => {
      const mockRows = [
        {
          id: 'rem-1',
          user_id: 'user-rem-123',
          task_id: 'task-1',
          remind_at: '2026-10-06T10:00:00.000Z',
          status: 'pending',
          snoozed_until: null,
          reminder_kind: 'relative_due',
          offset_minutes: 30,
          effective_at: '2026-10-06T10:00:00.000Z',
          created_at: '2026-10-06T08:00:00.000Z',
          updated_at: '2026-10-06T08:00:00.000Z',
        },
      ]

      const queryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockRows, error: null }),
      }

      vi.mocked(supabase.from).mockReturnValue(queryBuilder)

      const res = await getRemindersByTask(supabase, 'task-1')

      expect(supabase.from).toHaveBeenCalledWith('reminders')
      expect(queryBuilder.eq).toHaveBeenCalledWith('task_id', 'task-1')
      expect(queryBuilder.order).toHaveBeenCalledWith('effective_at', { ascending: true })
      expect(res).toHaveLength(1)
      expect(res[0].id).toBe('rem-1')
      expect(res[0].reminderKind).toBe('relative_due')
      expect(res[0].offsetMinutes).toBe(30)
    })
  })

  describe('getUpcomingRemindersWeb', () => {
    it('queries 7-day upcoming reminders and excludes userId from contract', async () => {
      const mockRows = [
        {
          id: 'rem-2',
          task_id: 'task-2',
          remind_at: '2026-10-07T08:00:00.000Z',
          status: 'pending',
          snoozed_until: null,
          reminder_kind: 'absolute',
          offset_minutes: null,
          effective_at: '2026-10-07T08:00:00.000Z',
          updated_at: '2026-10-06T08:00:00.000Z',
          tasks: {
            id: 'task-2',
            title: 'Prepare Presentation',
            status: 'todo',
            due_at: '2026-10-07T10:00:00.000Z',
            updated_at: '2026-10-06T08:00:00.000Z',
          },
        },
      ]

      const queryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockRows, error: null }),
      }

      vi.mocked(supabase.from).mockReturnValue(queryBuilder)

      const now = new Date('2026-10-06T00:00:00.000Z')
      const res = await getUpcomingRemindersWeb(supabase, now)

      expect(queryBuilder.in).toHaveBeenCalledWith('status', ['pending', 'snoozed'])
      expect(queryBuilder.gte).toHaveBeenCalledWith('effective_at', '2026-10-06T00:00:00.000Z')
      expect(res).toHaveLength(1)
      expect(res[0].taskTitle).toBe('Prepare Presentation')
      expect((res[0] as any).userId).toBeUndefined()
    })
  })

  describe('createReminder', () => {
    it('creates relative reminder with user_id from session', async () => {
      const createdRow = {
        id: 'rem-new',
        user_id: 'user-rem-123',
        task_id: 'task-1',
        remind_at: '2026-10-06T11:00:00.000Z',
        status: 'pending',
        snoozed_until: null,
        reminder_kind: 'relative_due',
        offset_minutes: 15,
        effective_at: '2026-10-06T11:00:00.000Z',
        created_at: '2026-10-06T08:00:00.000Z',
        updated_at: '2026-10-06T08:00:00.000Z',
      }

      const queryBuilder: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: createdRow, error: null }),
      }

      vi.mocked(supabase.from).mockReturnValue(queryBuilder)

      const res = await createReminder(supabase, {
        taskId: 'task-1',
        reminderKind: 'relative_due',
        offsetMinutes: 15,
      })

      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-rem-123',
          task_id: 'task-1',
          reminder_kind: 'relative_due',
          offset_minutes: 15,
        })
      )
      expect(res.id).toBe('rem-new')
    })

    it('rejects relative reminder missing offset_minutes', async () => {
      await expect(
        createReminder(supabase, {
          taskId: 'task-1',
          reminderKind: 'relative_due',
          offsetMinutes: null,
        })
      ).rejects.toThrow('Relative reminder requires a non-negative offset_minutes')
    })
  })

  describe('snoozeReminder and dismissReminder', () => {
    it('snoozes reminder and asserts optimistic concurrency', async () => {
      const updatedRow = {
        id: 'rem-1',
        user_id: 'user-rem-123',
        task_id: 'task-1',
        remind_at: '2026-10-06T11:00:00.000Z',
        status: 'snoozed',
        snoozed_until: '2026-10-06T11:15:00.000Z',
        reminder_kind: 'relative_due',
        offset_minutes: 15,
        effective_at: '2026-10-06T11:15:00.000Z',
        created_at: '2026-10-06T08:00:00.000Z',
        updated_at: '2026-10-06T08:30:00.000Z',
      }

      const queryBuilder: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [updatedRow], error: null }),
      }

      vi.mocked(supabase.from).mockReturnValue(queryBuilder)

      const res = await snoozeReminder(
        supabase,
        'rem-1',
        '2026-10-06T11:15:00.000Z',
        '2026-10-06T08:00:00.000Z'
      )

      expect(queryBuilder.update).toHaveBeenCalledWith({
        status: 'snoozed',
        snoozed_until: '2026-10-06T11:15:00.000Z',
      })
      expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'rem-1')
      expect(queryBuilder.eq).toHaveBeenCalledWith('updated_at', '2026-10-06T08:00:00.000Z')
      expect(res.status).toBe('snoozed')
      expect(res.snoozedUntil).toBe('2026-10-06T11:15:00.000Z')
    })

    it('dismisses reminder and clears snooze_until', async () => {
      const updatedRow = {
        id: 'rem-1',
        user_id: 'user-rem-123',
        task_id: 'task-1',
        remind_at: '2026-10-06T11:00:00.000Z',
        status: 'dismissed',
        snoozed_until: null,
        reminder_kind: 'relative_due',
        offset_minutes: 15,
        effective_at: '2026-10-06T11:00:00.000Z',
        created_at: '2026-10-06T08:00:00.000Z',
        updated_at: '2026-10-06T08:30:00.000Z',
      }

      const queryBuilder: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [updatedRow], error: null }),
      }

      vi.mocked(supabase.from).mockReturnValue(queryBuilder)

      const res = await dismissReminder(supabase, 'rem-1', '2026-10-06T08:00:00.000Z')

      expect(queryBuilder.update).toHaveBeenCalledWith({
        status: 'dismissed',
        snoozed_until: null,
      })
      expect(res.status).toBe('dismissed')
      expect(res.snoozedUntil).toBeNull()
    })
  })
})
