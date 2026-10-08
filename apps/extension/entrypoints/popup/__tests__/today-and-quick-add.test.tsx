import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { App } from '../App.js'
import type { ExtensionMessage, ExtensionResult, ExtensionState, ExtensionTodayTask } from '../../../lib/types.js'

describe('Today and Quick Add popup flows', () => {
  let messageHandler: (msg: ExtensionMessage) => Promise<ExtensionResult>
  let mockState: ExtensionState

  beforeEach(() => {
    mockState = {
      status: 'authenticated',
      user: {
        id: 'user-1',
        email: 'phat@example.com',
        displayName: 'Phat Phung',
        timezone: 'Asia/Ho_Chi_Minh',
        isActive: true,
        mustChangePassword: false,
        locale: 'vi',
      },
      todayTasks: [
        {
          id: 'task-1',
          title: 'Morning review',
          status: 'todo',
          priority: 'medium',
          dueDateKind: 'date_time',
          dueAt: '2026-10-06T09:00:00.000Z',
          updatedAt: '2026-10-06T08:00:00.000Z',
        },
      ],
      syncMetadata: {
        lastSuccessfulSyncAt: '2026-10-06T08:00:00.000Z',
        lastSyncError: null,
        isStale: false,
      },
    }

    const chromeMock = {
      runtime: {
        lastError: null,
        sendMessage: vi.fn((message: ExtensionMessage, callback: (res: unknown) => void) => {
          messageHandler(message).then((res) => callback(res))
        }),
      },
      tabs: {
        create: vi.fn(),
      },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.stubGlobal('chrome', chromeMock as any)
  })

  it('1. Today view: renders active tasks, due time and stale indicator when stale', async () => {
    mockState.syncMetadata.isStale = true

    messageHandler = async (msg) => {
      if (msg.type === 'get-state') {
        return { ok: true, data: mockState }
      }
      return { ok: true, data: null }
    }

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Hôm nay' })).toBeInTheDocument()
    expect(screen.getByText('Morning review')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Đang xem dữ liệu ngoại tuyến')
  })

  it('2. Complete task: sends complete-task message to background', async () => {
    let completedTaskId = ''
    messageHandler = async (msg) => {
      if (msg.type === 'get-state') return { ok: true, data: mockState }
      if (msg.type === 'complete-task') {
        completedTaskId = msg.payload.taskId
        mockState.todayTasks = []
        return { ok: true, data: { id: completedTaskId, updatedAt: 'new-time' } }
      }
      if (msg.type === 'sync') return { ok: true, data: mockState }
      return { ok: true, data: null }
    }

    const user = userEvent.setup()
    render(<App />)

    const completeBtn = await screen.findByLabelText(/hoàn thành việc: morning review/i)
    await user.click(completeBtn)

    await waitFor(() => {
      expect(completedTaskId).toBe('task-1')
    })
  })

  it('3. Quick Add: validates title and contains NO due, reminder, or source URL controls', async () => {
    messageHandler = async (msg) => {
      if (msg.type === 'get-state') return { ok: true, data: mockState }
      return { ok: true, data: null }
    }

    const user = userEvent.setup()
    render(<App />)

    const addBtn = await screen.findByLabelText('Thêm việc')
    await user.click(addBtn)

    expect(await screen.findByRole('heading', { name: 'Thêm công việc nhanh' })).toBeInTheDocument()

    // Title input exists
    const titleInput = screen.getByLabelText(/tiêu đề công việc/i)
    expect(titleInput).toBeInTheDocument()

    // Absence of optional controls in MVP Quick Add:
    expect(screen.queryByLabelText(/hạn chót|ngày|due date/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/nhắc nhở|reminder/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/liên kết|source url|url/i)).not.toBeInTheDocument()

    // Title validation for blank title
    const submitBtn = screen.getByRole('button', { name: 'Thêm việc' })
    await user.click(submitBtn)

    expect(await screen.findByRole('alert')).toHaveTextContent('Tiêu đề công việc không được để trống')
  })

  it('4. Quick Add success: sends message to background, resets and returns to Today', async () => {
    let createdTitle = ''

    messageHandler = async (msg) => {
      if (msg.type === 'get-state') return { ok: true, data: mockState }
      if (msg.type === 'quick-add') {
        createdTitle = msg.payload.title
        const newTask: ExtensionTodayTask = {
          id: 'task-new',
          title: createdTitle,
          status: 'todo',
          priority: 'medium',
          dueDateKind: 'date_time',
          dueAt: null,
          updatedAt: '2026-10-06T10:00:00.000Z',
        }
        mockState.todayTasks.push(newTask)
        return { ok: true, data: newTask }
      }
      if (msg.type === 'sync') return { ok: true, data: mockState }
      return { ok: true, data: null }
    }

    const user = userEvent.setup()
    render(<App />)

    const addBtn = await screen.findByLabelText('Thêm việc')
    await user.click(addBtn)

    const titleInput = await screen.findByLabelText(/tiêu đề công việc/i)
    const submitBtn = screen.getByRole('button', { name: 'Thêm việc' })

    await user.type(titleInput, 'Buy milk')
    await user.click(submitBtn)

    await waitFor(() => {
      expect(createdTitle).toBe('Buy milk')
    })

    // Returned to Today view and shows new task
    expect(await screen.findByRole('heading', { name: 'Hôm nay' })).toBeInTheDocument()
    expect(screen.getByText('Buy milk')).toBeInTheDocument()
  })
})
