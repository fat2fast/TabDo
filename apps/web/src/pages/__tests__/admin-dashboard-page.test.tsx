import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminDashboardPage } from '../AdminDashboardPage'
import { I18nProvider } from '../../features/i18n/i18n-provider'
import { supabase } from '../../lib/supabase'

vi.mock('../../lib/supabase', () => {
  return {
    supabase: {
      functions: {
        invoke: vi.fn(),
      },
    },
  }
})

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <I18nProvider>
          <AdminDashboardPage />
        </I18nProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders aggregate stats metrics and privacy banner', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        totalUsers: 12,
        activeUsers: 10,
        inactiveUsers: 2,
        totalTasks: 45,
        todoTasks: 20,
        inProgressTasks: 10,
        doneTasks: 15,
      },
      error: null,
    } as any)

    renderDashboard()

    // Wait for data to load
    expect(await screen.findByText('12')).toBeInTheDocument()

    // Metric values
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getAllByText('10')).toHaveLength(2)
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /tổng quan quản trị/i })).toBeInTheDocument()

    // Privacy banner
    expect(screen.getByText(/bảo đảm quyền riêng tư cá nhân/i)).toBeInTheDocument()
  })
})
