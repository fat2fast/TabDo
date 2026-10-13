import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskFiltersPopover } from '../components/task-filters-popover'

vi.mock('../hooks/use-categories', () => ({
  useCategories: () => ({
    data: [
      { id: 'cat-work', name: 'Công việc', color: '#3b82f6' },
      { id: 'cat-health', name: 'Sức khỏe', color: '#10b981' },
    ],
    isLoading: false,
  }),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('TaskFiltersPopover', () => {
  const defaultProps = {
    onStatusChange: vi.fn(),
    onPriorityChange: vi.fn(),
    onCategoryChange: vi.fn(),
    onScopeChange: vi.fn(),
    onCompletedRangeChange: vi.fn(),
    onClear: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders trigger button and badge when active filters exist', () => {
    const { rerender } = render(
      <TaskFiltersPopover {...defaultProps} />,
      { wrapper: createWrapper() }
    )

    const trigger = screen.getByTestId('filter-popover-trigger')
    expect(trigger).toBeInTheDocument()
    expect(screen.getByText('Bộ lọc')).toBeInTheDocument()
    expect(screen.queryByTestId('filter-count-badge')).not.toBeInTheDocument()

    // Rerender with active filters (status and priority)
    rerender(
      <TaskFiltersPopover {...defaultProps} status="in_progress" priority="high" />
    )

    const badge = screen.getByTestId('filter-count-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('2')
  })

  it('toggles popover open/close on trigger button click', async () => {
    const user = userEvent.setup()

    render(
      <TaskFiltersPopover {...defaultProps} />,
      { wrapper: createWrapper() }
    )

    const trigger = screen.getByTestId('filter-popover-trigger')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    // Click to open
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('heading', { name: /bộ lọc công việc/i })).toBeInTheDocument()

    // Click close button inside popover
    const closeBtn = screen.getByLabelText('Đóng bộ lọc')
    await user.click(closeBtn)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('calls onClear and closes popover when clicking Xóa tất cả bộ lọc', async () => {
    const user = userEvent.setup()

    render(
      <TaskFiltersPopover {...defaultProps} status="todo" priority="high" />,
      { wrapper: createWrapper() }
    )

    const trigger = screen.getByTestId('filter-popover-trigger')
    await user.click(trigger)

    const clearBtn = screen.getByText('Xóa tất cả bộ lọc')
    await user.click(clearBtn)

    expect(defaultProps.onClear).toHaveBeenCalledTimes(1)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes popover on Escape key press', async () => {
    const user = userEvent.setup()

    render(
      <TaskFiltersPopover {...defaultProps} />,
      { wrapper: createWrapper() }
    )

    const trigger = screen.getByTestId('filter-popover-trigger')
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })
})
