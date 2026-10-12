import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfirmProvider } from '../../../components/ui'
import { I18nProvider } from '../../i18n/i18n-provider'
import { TaskTrash } from '../components/task-trash'
import { supabase } from '../../../lib/supabase'

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

vi.mock('../../auth/auth-provider', () => ({
  useAuth: () => ({
    profile: { timezone: 'Asia/Ho_Chi_Minh' },
  }),
}))

describe('TaskTrash Component (Phase 5 UI/UX)', () => {
  let queryClient: QueryClient

  const mockTasks = [
    {
      id: 'task-trash-1',
      user_id: 'u-1',
      title: 'Trashed Task 1',
      description: null,
      status: 'todo',
      priority: 'high',
      due_at: null,
      due_date_kind: 'none',
      category_id: null,
      parent_id: null,
      recurrence_rule: null,
      recurrence_parent_id: null,
      source_url: null,
      deleted_at: new Date(Date.now() - 2 * 86400000).toISOString(), // 2 days ago -> 28 days left
      deletion_batch_id: 'batch-1',
      purge_status: 'none',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    },
    {
      id: 'task-trash-2',
      user_id: 'u-1',
      title: 'Trashed Task 2 with Purge Pending',
      description: null,
      status: 'todo',
      priority: 'low',
      due_at: null,
      due_date_kind: 'none',
      category_id: null,
      parent_id: null,
      recurrence_rule: null,
      recurrence_parent_id: null,
      source_url: null,
      deleted_at: new Date(Date.now() - 29 * 86400000).toISOString(), // 29 days ago -> 1 day left
      deletion_batch_id: 'batch-2',
      purge_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'categories') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        } as any
      }
      if (table === 'tasks') {
        const query: any = {
          select: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve({ data: mockTasks, error: null }),
        }
        return query
      }
      return {} as any
    })
  })

  function renderTrash(onSelect = vi.fn()) {
    return render(
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <ConfirmProvider>
            <TaskTrash onSelectTask={onSelect} />
          </ConfirmProvider>
        </I18nProvider>
      </QueryClientProvider>
    )
  }

  it('renders 30-day retention notice and trashed task list with remaining countdown', async () => {
    renderTrash()

    expect(
      await screen.findByText(/Các mục trong Thùng rác sẽ được tự động xóa vĩnh viễn sau 30 ngày/i)
    ).toBeInTheDocument()

    expect(await screen.findByText('Trashed Task 1')).toBeInTheDocument()
    expect(await screen.findByText('Trashed Task 2 with Purge Pending')).toBeInTheDocument()

    // Days left countdown
    expect(screen.getByText(/28\s+ngày/i)).toBeInTheDocument()
    expect(screen.getByText(/1\s+ngày/i)).toBeInTheDocument()

    // Pending purge badge
    expect(screen.getByText(/Đang chờ xử lý xóa vĩnh viễn/i)).toBeInTheDocument()
  })

  it('allows restoring a trashed task via restore_task RPC', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any)

    renderTrash()

    const restoreButtons = await screen.findAllByRole('button', { name: /Khôi phục công việc/i })
    expect(restoreButtons.length).toBeGreaterThan(0)

    await user.click(restoreButtons[0])

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('restore_task', {
        p_task_id: 'task-trash-1',
      })
    })

    expect(
      await screen.findByText(/Đã khôi phục công việc: "Trashed Task 1"/i)
    ).toBeInTheDocument()
  })

  it('requires confirmation before permanently purging via request_purge_task RPC', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any)

    renderTrash()

    const purgeButton = await screen.findByRole('button', {
      name: /Xóa vĩnh viễn công việc Trashed Task 1/i,
    })

    // Click purge button on task 1
    await user.click(purgeButton)

    // Confirmation dialog should appear
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Xóa vĩnh viễn công việc\?/i)).toBeInTheDocument()

    // Click confirm button in modal
    const confirmBtn = screen.getByTestId('confirm-dialog-btn')
    await user.click(confirmBtn)

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('request_purge_task', {
        p_task_id: 'task-trash-1',
      })
    })

    expect(
      await screen.findByText(/Đã xóa vĩnh viễn công việc: "Trashed Task 1"/i)
    ).toBeInTheDocument()
  })

  it('shows empty state when no tasks are in trash', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'tasks') {
        const query: any = {
          select: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve({ data: [], error: null }),
        }
        return query
      }
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any
    })

    renderTrash()

    expect(await screen.findByText(/Thùng rác trống/i)).toBeInTheDocument()
  })
})
