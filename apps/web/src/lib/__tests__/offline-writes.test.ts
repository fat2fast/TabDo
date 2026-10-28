import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCategory } from '../../features/tasks/api/categories'
import { createTask, deleteTask, deleteTaskAttachment, uploadTaskAttachment } from '../../features/tasks/api/tasks'
import { createReminder } from '../../features/reminders/api/reminders'
import { deleteScheduleBlock, updateScheduleBlock } from '../../features/scheduling/api/schedule-blocks'
import { supabase } from '../supabase'
import { advanceWriteIdentity, getPendingWrites } from '../write-safety'

vi.mock('../supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn(), auth: { getSession: vi.fn() }, storage: { from: vi.fn() } } }))

afterEach(() => vi.restoreAllMocks())
beforeEach(() => vi.clearAllMocks())

describe('offline writes', () => {
  it('returns the created task when connectivity is lost after the primary insert', async () => {
    let online = true
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'a' } } }, error: null } as never)
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table !== 'tasks') throw new Error('activity must not be written offline')
      return { insert: () => ({ select: () => ({ single: async () => { online = false; return { data: { id: 'created', user_id: 'a', title: 'Task', status: 'todo', priority: 'medium' }, error: null } } }) }) } as never
    })
    await expect(createTask({ title: 'Task' } as any)).resolves.toMatchObject({ id: 'created' })
    expect(supabase.from).toHaveBeenCalledTimes(1)
  })

  it('returns a committed schedule update when its activity cannot be written', async () => {
    let online = true
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
    const row = { id: 'block', user_id: 'a', task_id: 'task', title: 'Updated', start_at: '2026-01-01T08:00:00Z', end_at: '2026-01-01T09:00:00Z', created_at: '', updated_at: '' }
    const query: any = { update: () => query, eq: () => query, select: async () => { online = false; return { data: [row], error: null } } }
    const client = { from: vi.fn(() => query), auth: { getUser: vi.fn() } } as any
    await expect(updateScheduleBlock(client, 'block', { title: 'Updated', previousUpdatedAt: 'old' })).resolves.toMatchObject({ id: 'block' })
    expect(client.auth.getUser).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
  })
  it('rejects before calling Supabase and does not replay when online', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const client = { from: vi.fn(), auth: { getUser: vi.fn() } } as any
    const writes = [
      createCategory({ name: 'Personal' } as any), deleteTask('task'),
      uploadTaskAttachment('task', new File(['a'], 'a.txt')),
      createReminder(client, {} as any), deleteScheduleBlock(client, 'id', 'revision'),
    ]
    const results = await Promise.allSettled(writes)
    expect(results.every(result => result.status === 'rejected')).toBe(true)
    expect(supabase.from).not.toHaveBeenCalled()
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(supabase.auth.getSession).not.toHaveBeenCalled()
    expect(supabase.storage.from).not.toHaveBeenCalled()
    expect(client.from).not.toHaveBeenCalled()
    expect(client.auth.getUser).not.toHaveBeenCalled()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('keeps an upload pending and stops metadata writes after identity changes', async () => {
    let finish!: (value: { error: null }) => void
    const upload = vi.fn(() => new Promise<{ error: null }>(resolve => { finish = resolve }))
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'a' } } }, error: null } as never)
    vi.mocked(supabase.storage.from).mockReturnValue({ upload } as never)
    const result = uploadTaskAttachment('task', new File(['a'], 'a.txt'))
    await vi.waitFor(() => expect(upload).toHaveBeenCalled())
    expect(getPendingWrites()).toBe(1)
    advanceWriteIdentity()
    finish({ error: null })
    await expect(result).rejects.toThrow(/phiên đăng nhập đã thay đổi/i)
    expect(supabase.from).not.toHaveBeenCalled()
    expect(getPendingWrites()).toBe(0)
  })

  it('tracks compensation and attachment deletion through their final steps', async () => {
    let finishRemove!: (value: { error: null }) => void
    const remove = vi.fn(() => new Promise<{ error: null }>(resolve => { finishRemove = resolve }))
    const upload = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'a' } } }, error: null } as never)
    vi.mocked(supabase.storage.from).mockReturnValue({ upload, remove } as never)
    vi.mocked(supabase.from).mockReturnValue({ insert: () => ({ select: () => ({ single: async () => ({ error: { message: 'metadata failed' } }) }) }) } as never)
    const result = uploadTaskAttachment('task', new File(['a'], 'a.txt'))
    await vi.waitFor(() => expect(remove).toHaveBeenCalled())
    expect(getPendingWrites()).toBe(1)
    finishRemove({ error: null })
    await expect(result).rejects.toThrow(/metadata failed/)
    expect(getPendingWrites()).toBe(0)

    vi.mocked(supabase.from).mockReturnValue({ delete: () => ({ eq: async () => ({ error: null }) }) } as never)
    const deletion = deleteTaskAttachment({ id: 'attachment', kind: 'file', objectPath: 'a/task/file' } as any)
    await vi.waitFor(() => expect(remove).toHaveBeenCalledTimes(2))
    expect(getPendingWrites()).toBe(1)
    finishRemove({ error: null })
    await deletion
    expect(supabase.from).toHaveBeenCalledWith('task_attachments')
    expect(getPendingWrites()).toBe(0)
  })
})
