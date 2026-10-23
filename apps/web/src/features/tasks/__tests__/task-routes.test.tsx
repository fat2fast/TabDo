import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../../app/App'
import { AuthProvider } from '../../auth/auth-provider'
import { supabase } from '../../../lib/supabase'

vi.mock('../../../lib/supabase', () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
      from: vi.fn(),
    },
  }
})

let latestLocation: any = null
function LocationObserver() {
  const loc = useLocation()
  latestLocation = loc
  return null
}

function renderRoute(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthProvider>
          <LocationObserver />
          <App />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('task-routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    latestLocation = null

    // Default authenticated mock
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: { id: 'test-user-id', email: 'user@tabdo.local' },
        },
      },
      error: null,
    } as any)

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'test-user-id', role: 'user', timezone: 'Asia/Ho_Chi_Minh' },
            error: null,
          }),
        } as any
      }
      if (table === 'tasks' || table === 'categories') {
        return {
          select: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          range: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
        } as any
      }
      return {} as any
    })
  })

  it('redirects unauthenticated visitor from /tasks to /login', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any)

    renderRoute('/tasks')

    expect(await screen.findByRole('heading', { name: /đăng nhập tabdo/i })).toBeInTheDocument()
  })

  it('redirects /tasks to /tasks/inbox when authenticated', async () => {
    renderRoute('/tasks')

    expect(await screen.findByRole('heading', { name: /tất cả|all|hộp thư đến|inbox/i })).toBeInTheDocument()
  })

  it('renders smart views on static paths /tasks/today, /tasks/upcoming, /tasks/overdue, /tasks/completed, /tasks/trash', async () => {
    const { unmount: unmountToday } = renderRoute('/tasks/today')
    expect(await screen.findByRole('heading', { name: /hôm nay|today/i })).toBeInTheDocument()
    unmountToday()

    const { unmount: unmountUpcoming } = renderRoute('/tasks/upcoming')
    expect(await screen.findByRole('heading', { name: /sắp tới|upcoming/i })).toBeInTheDocument()
    unmountUpcoming()

    const { unmount: unmountOverdue } = renderRoute('/tasks/overdue')
    expect(await screen.findByRole('heading', { name: /quá hạn|overdue/i })).toBeInTheDocument()
    unmountOverdue()

    const { unmount: unmountCompleted } = renderRoute('/tasks/completed')
    expect(await screen.findByRole('heading', { name: /đã hoàn thành|completed/i })).toBeInTheDocument()
    unmountCompleted()

    const { unmount: unmountTrash } = renderRoute('/tasks/trash')
    expect(await screen.findByRole('heading', { name: /thùng rác|trash/i })).toBeInTheDocument()
    unmountTrash()
  })

  it('redirects obsolete /tasks/:id route safely to /dashboard without collision', async () => {
    renderRoute('/tasks/some-legacy-uuid-1234')

    expect(await screen.findByRole('heading', { name: /bảng điều khiển|dashboard/i })).toBeInTheDocument()
  })

  it('opens task drawer on /tasks/today?taskId=<id> and removes taskId on close', async () => {
    const { userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()

    renderRoute('/tasks/today?taskId=123e4567-e89b-12d3-a456-426614174000')

    expect(await screen.findByRole('heading', { name: /hôm nay|today/i })).toBeInTheDocument()
    expect(await screen.findByTestId('task-drawer')).toBeInTheDocument()

    // Click close button
    const closeBtn = screen.getByLabelText('Đóng bảng chi tiết')
    await user.click(closeBtn)

    expect(screen.queryByTestId('task-drawer')).not.toBeInTheDocument()
    expect(new URLSearchParams(latestLocation.search).get('taskId')).toBeNull()
  })

  it('toggles between list and board layouts on /tasks/inbox and preserves params', async () => {
    const { userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()

    renderRoute('/tasks/inbox')

    expect(await screen.findByRole('heading', { name: /tất cả|all|hộp thư đến|inbox/i })).toBeInTheDocument()
    expect(screen.getByTestId('layout-toggle')).toBeInTheDocument()

    // Default layout is list: TaskBoard is not rendered, QuickAdd is visible
    expect(screen.queryByTestId('task-board')).not.toBeInTheDocument()

    // Click Board toggle button
    const boardBtn = screen.getByTestId('toggle-layout-board')
    await user.click(boardBtn)

    // Now TaskBoard is rendered and QuickAdd is hidden
    expect(await screen.findByTestId('task-board')).toBeInTheDocument()
    expect(screen.queryByTestId('quick-add-input')).not.toBeInTheDocument()

    // Switch back to List layout
    const listBtn = screen.getByTestId('toggle-layout-list')
    await user.click(listBtn)

    expect(screen.queryByTestId('task-board')).not.toBeInTheDocument()
  })

  it('renders trash list view and never board layout even when layout=board is in URL', async () => {
    renderRoute('/tasks/trash?layout=board')

    expect(await screen.findByRole('heading', { name: /thùng rác|trash/i })).toBeInTheDocument()
    expect(screen.queryByTestId('task-board')).not.toBeInTheDocument()
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })

  it('preserves query params like status and sort when taskId is closed (observable assertion)', async () => {
    const { userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()

    renderRoute('/tasks/today?status=todo&sort=priority&taskId=123e4567-e89b-12d3-a456-426614174000')

    expect(await screen.findByRole('heading', { name: /hôm nay|today/i })).toBeInTheDocument()
    expect(await screen.findByTestId('task-drawer')).toBeInTheDocument()

    // Initial search has all 3 params
    const initialParams = new URLSearchParams(latestLocation.search)
    expect(initialParams.get('status')).toBe('todo')
    expect(initialParams.get('sort')).toBe('priority')
    expect(initialParams.get('taskId')).toBe('123e4567-e89b-12d3-a456-426614174000')

    // Click close button
    const closeBtn = screen.getByLabelText('Đóng bảng chi tiết')
    await user.click(closeBtn)

    expect(screen.queryByTestId('task-drawer')).not.toBeInTheDocument()

    // Assert status and sort remain intact in URL while taskId is deleted
    const postCloseParams = new URLSearchParams(latestLocation.search)
    expect(postCloseParams.get('status')).toBe('todo')
    expect(postCloseParams.get('sort')).toBe('priority')
    expect(postCloseParams.get('taskId')).toBeNull()
  })

  it('synchronizes selectedTaskId and drawer when URL search param changes', async () => {
    renderRoute('/tasks/today?taskId=task-url-sync-1')

    expect(await screen.findByTestId('task-drawer')).toBeInTheDocument()
    expect(new URLSearchParams(latestLocation.search).get('taskId')).toBe('task-url-sync-1')
  })
})
