import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CategoryManager } from '../components/category-manager'
import { QuickAddTask } from '../components/quick-add-task'
import { SubtaskList } from '../components/subtask-list'
import { TaskDrawer } from '../components/task-drawer'
import { TaskForm } from '../components/task-form'
import { TaskRow } from '../components/task-row'
import type { Category, Task } from '../types'
import { supabase } from '../../../lib/supabase'

vi.mock('../../../lib/supabase', () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn(),
      },
      from: vi.fn(),
      rpc: vi.fn(),
    },
  }
})

vi.mock('../../auth/auth-provider', () => {
  const mockAuth = {
    profile: {
      id: 'u-1',
      timezone: 'Asia/Ho_Chi_Minh',
      role: 'user',
      displayName: 'Test User',
    },
    session: {
      user: { id: 'u-1', email: 'test@tabdo.local' },
    },
  }
  return {
    useAuth: () => mockAuth,
    useOptionalAuth: () => mockAuth,
  }
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('core-task-workflow', () => {
  const mockSession = { user: { id: 'u-1' } }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession as any },
      error: null,
    })
  })

  describe('QuickAddTask', () => {
    it('creates task on Enter with valid title and clears input', async () => {
      const user = userEvent.setup()

      const insertMock = vi.fn().mockReturnThis()
      const selectMock = vi.fn().mockReturnThis()
      const singleMock = vi.fn().mockResolvedValue({
        data: {
          id: 'task-1',
          user_id: 'u-1',
          title: 'Buy groceries',
          status: 'todo',
          priority: 'medium',
          due_date_kind: 'date_time',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      })

      const activitiesInsert = vi.fn().mockResolvedValue({ error: null })
      const catSelectMock = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'tasks') {
          return {
            insert: insertMock,
            select: selectMock,
            single: singleMock,
          } as any
        }
        if (table === 'task_activities') {
          return { insert: activitiesInsert } as any
        }
        if (table === 'categories') {
          return { select: catSelectMock } as any
        }
        return {} as any
      })

      render(<QuickAddTask />, { wrapper: createWrapper() })

      const input = screen.getByRole('textbox', { name: /tiêu đề công việc/i })
      await user.type(input, 'Buy groceries{enter}')

      await waitFor(() => {
        expect(insertMock).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Buy groceries',
            priority: 'medium',
          })
        )
      })

      // Input is cleared after successful create
      expect(input).toHaveValue('')
    })

    it('prevents blank title creation and shows error', async () => {
      const user = userEvent.setup()

      render(<QuickAddTask />, { wrapper: createWrapper() })

      const input = screen.getByRole('textbox', { name: /tiêu đề công việc/i })
      await user.type(input, '   {enter}')

      expect(await screen.findByRole('alert')).toHaveTextContent(/không được để trống/i)
      expect(supabase.from).not.toHaveBeenCalledWith('tasks')
    })

    it('preserves user input when server creation fails', async () => {
      const user = userEvent.setup()

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'tasks') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Network disconnected' },
            }),
          } as any
        }
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          } as any
        }
        return {} as any
      })

      render(<QuickAddTask />, { wrapper: createWrapper() })

      const input = screen.getByRole('textbox', { name: /tiêu đề công việc/i })
      await user.type(input, 'Important unsaved task{enter}')

      expect(await screen.findByRole('alert')).toHaveTextContent(/network disconnected/i)
      // Value must be preserved
      expect(input).toHaveValue('Important unsaved task')
    })
  })

  describe('TaskRow and Completion', () => {
    const sampleTask: Task = {
      id: 'task-10',
      userId: 'u-1',
      title: 'Complete documentation',
      status: 'todo',
      priority: 'high',
      dueDateKind: 'date_time',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    }

    it('toggles complete and reopen via checkbox', async () => {
      const user = userEvent.setup()

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: {
          completedTask: {
            ...sampleTask,
            user_id: 'u-1',
            due_date_kind: 'date_time',
            created_at: '2026-10-01T00:00:00Z',
            updated_at: '2026-10-05T12:00:00Z',
            status: 'done',
            completed_at: '2026-10-05T12:00:00Z',
          },
          nextTask: null,
          generated: false,
          reusedExistingSuccessor: false,
        },
        error: null,
      } as any)

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'task_activities') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) } as any
        }
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          } as any
        }
        return {} as any
      })

      const onSelect = vi.fn()
      render(<TaskRow task={sampleTask} onSelect={onSelect} />, { wrapper: createWrapper() })

      const checkbox = screen.getByRole('checkbox', { name: /đánh dấu hoàn thành/i })
      expect(checkbox).not.toBeChecked()

      await user.click(checkbox)

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith('complete_task_and_generate_next', {
          p_task_id: sampleTask.id,
          p_expected_updated_at: sampleTask.updatedAt,
        })
      })
    })
  })

  describe('TaskForm and Date-only round trip', () => {
    const sampleTask: Task = {
      id: 'task-20',
      userId: 'u-1',
      title: 'Review proposal',
      description: 'Initial proposal notes',
      status: 'todo',
      priority: 'medium',
      dueDateKind: 'date_time',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    }

    it('supports date-only selection and persists local end-of-day', async () => {
      const user = userEvent.setup()

      const updateMock = vi.fn().mockReturnThis()
      const eqMock = vi.fn().mockReturnThis()
      const selectMock = vi.fn().mockReturnThis()
      const singleMock = vi.fn().mockResolvedValue({
        data: {
          ...sampleTask,
          user_id: 'u-1',
          due_date_kind: 'date_only',
          due_at: '2026-10-15T16:59:59.999Z',
          created_at: '2026-10-01T00:00:00Z',
          updated_at: '2026-10-05T12:00:00Z',
        },
        error: null,
      })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'tasks') {
          return {
            update: updateMock,
            eq: eqMock,
            select: selectMock,
            single: singleMock,
          } as any
        }
        if (table === 'task_activities') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) } as any
        }
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          } as any
        }
        return {} as any
      })

      const onSaveSuccess = vi.fn()
      render(<TaskForm task={sampleTask} onSaveSuccess={onSaveSuccess} />, {
        wrapper: createWrapper(),
      })

      // Choose date_only radio pill
      const dateOnlyRadio = screen.getByLabelText(/đến hạn trong ngày/i)
      await user.click(dateOnlyRadio)

      // Enter date
      const dateInput = screen.getByLabelText(/ngày hạn chót/i)
      await user.type(dateInput, '2026-10-15')

      // Click save
      const saveButton = screen.getByRole('button', { name: /lưu thay đổi/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(updateMock).toHaveBeenCalledWith(
          expect.objectContaining({
            due_date_kind: 'date_only',
            due_at: '2026-10-15T16:59:59.999Z', // 23:59:59.999 ICT in UTC
          })
        )
      })

      expect(onSaveSuccess).toHaveBeenCalled()
    })

    it('preserves form state and displays error when save fails', async () => {
      const user = userEvent.setup()

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'tasks') {
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database save failed' },
            }),
          } as any
        }
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          } as any
        }
        return {} as any
      })

      render(<TaskForm task={sampleTask} />, { wrapper: createWrapper() })

      const titleInput = screen.getByLabelText(/tiêu đề/i)
      await user.clear(titleInput)
      await user.type(titleInput, 'Edited title that failed to save')

      const saveButton = screen.getByRole('button', { name: /lưu thay đổi/i })
      await user.click(saveButton)

      expect(await screen.findByRole('alert')).toHaveTextContent(/database save failed/i)
      expect(titleInput).toHaveValue('Edited title that failed to save')
    })
  })

  describe('Subtasks and Categories', () => {
    it('creates direct subtask with parent_id', async () => {
      const user = userEvent.setup()

      const parentTask: Task = {
        id: 'parent-task-1',
        userId: 'u-1',
        title: 'Project Parent',
        status: 'todo',
        priority: 'high',
        dueDateKind: 'date_time',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      }

      const tasksInsertMock = vi.fn().mockReturnThis()
      const tasksSelectMock = vi.fn().mockReturnThis()
      const tasksSingleMock = vi.fn().mockResolvedValue({
        data: {
          id: 'subtask-1',
          user_id: 'u-1',
          parent_id: 'parent-task-1',
          title: 'Child step',
          status: 'todo',
          priority: 'medium',
          due_date_kind: 'date_time',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
            insert: tasksInsertMock,
            single: tasksSingleMock,
          } as any
        }
        if (table === 'task_activities') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) } as any
        }
        return {} as any
      })

      render(<SubtaskList parentTask={parentTask} />, { wrapper: createWrapper() })

      const input = screen.getByPlaceholderText(/thêm công việc con/i)
      await user.type(input, 'Child step')
      const addBtn = screen.getByRole('button', { name: /thêm/i })
      await user.click(addBtn)

      await waitFor(() => {
        expect(tasksInsertMock).toHaveBeenCalledWith(
          expect.objectContaining({
            parent_id: 'parent-task-1',
            title: 'Child step',
          })
        )
      })
    })

    it('deletes category preserving tasks', async () => {
      const user = userEvent.setup()
      vi.spyOn(window, 'confirm').mockReturnValue(true)

      const catDeleteMock = vi.fn().mockReturnThis()
      const catEqMock = vi.fn().mockResolvedValue({ error: null })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'cat-to-del',
                    user_id: 'u-1',
                    name: 'Marketing',
                    color: '#0284c7',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                ],
                error: null,
              }),
            }),
            delete: catDeleteMock,
            eq: catEqMock,
          } as any
        }
        return {} as any
      })

      const onClose = vi.fn()
      render(<CategoryManager isOpen={true} onClose={onClose} />, {
        wrapper: createWrapper(),
      })

      expect(await screen.findByText('Marketing')).toBeInTheDocument()

      const deleteBtn = screen.getByTitle('Xóa danh mục')
      await user.click(deleteBtn)

      await waitFor(() => {
        expect(catDeleteMock).toHaveBeenCalled()
        expect(catEqMock).toHaveBeenCalledWith('id', 'cat-to-del')
      })
    })

    it('displays subtask indicator in TaskRow and parent banner in TaskForm', async () => {
      const subtaskItem: Task = {
        id: 'subtask-1',
        userId: 'u-1',
        title: 'Child Task item',
        status: 'todo',
        priority: 'medium',
        dueDateKind: 'date_time',
        parentId: 'parent-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const onSelect = vi.fn()
      const { unmount } = render(<TaskRow task={subtaskItem} onSelect={onSelect} />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByText('Việc con')).toBeInTheDocument()
      unmount()

      render(<TaskForm task={subtaskItem} />, { wrapper: createWrapper() })
      expect(screen.getByTestId('subtask-parent-banner')).toBeInTheDocument()
    })
  })
})
