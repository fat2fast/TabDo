import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'

export interface AdminUserItem {
  id: string
  email: string
  displayName: string | null
  role: 'admin' | 'user'
  isActive: boolean
  mustChangePassword: boolean
  locale: string
  createdAt: string
  updatedAt: string
  bannedUntil: string | null
  taskCount: number
  todoCount: number
  inProgressCount: number
  doneCount: number
}

export interface AdminUsersResponse {
  users: AdminUserItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface AdminStatsResponse {
  totalUsers: number
  activeUsers: number
  inactiveUsers: number
  totalTasks: number
  todoTasks: number
  inProgressTasks: number
  doneTasks: number
}

export interface AdminUsersFilterParams {
  page?: number
  pageSize?: number
  search?: string
  role?: string
  status?: string
  sortBy?: 'createdAt' | 'email' | 'displayName' | 'taskCount'
  sortOrder?: 'asc' | 'desc'
}

export async function fetchAdminStats(): Promise<AdminStatsResponse> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { stats: true },
  })

  if (error) {
    let msg = error.message
    if (typeof (error as any).context?.json === 'function') {
      try {
        const json = await (error as any).context.json()
        if (json?.error) msg = json.error
      } catch {
        // ignore
      }
    }
    throw new Error(msg || 'Failed to fetch admin stats')
  }

  return data as AdminStatsResponse
}

export async function fetchAdminUsers(params: AdminUsersFilterParams = {}): Promise<AdminUsersResponse> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 10,
      search: params.search ?? '',
      role: params.role ?? 'all',
      status: params.status ?? 'all',
      sortBy: params.sortBy ?? 'createdAt',
      sortOrder: params.sortOrder ?? 'desc',
    },
  })

  if (error) {
    let msg = error.message
    if (typeof (error as any).context?.json === 'function') {
      try {
        const json = await (error as any).context.json()
        if (json?.error) msg = json.error
      } catch {
        // ignore
      }
    }
    throw new Error(msg || 'Failed to fetch admin users')
  }

  return data as AdminUsersResponse
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: fetchAdminStats,
    staleTime: 30_000,
  })
}

export function useAdminUsers(params: AdminUsersFilterParams = {}) {
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => fetchAdminUsers(params),
    staleTime: 15_000,
  })
}

export function useAdminUserLifecycle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ action, userId }: { action: 'activate' | 'deactivate'; userId: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action, userId },
      })

      if (error) {
        let msg = error.message
        if (typeof (error as any).context?.json === 'function') {
          try {
            const json = await (error as any).context.json()
            if (json?.error) msg = json.error
          } catch {
            // ignore
          }
        }
        throw new Error(msg || `Failed to ${action} user`)
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
  })
}

export function useAdminCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      email,
      displayName,
      initialPassword,
    }: {
      email: string
      displayName?: string
      initialPassword?: string
    }) => {
      const payload: { email: string; displayName?: string; initialPassword?: string } = {
        email,
      }
      if (displayName) payload.displayName = displayName
      if (initialPassword) payload.initialPassword = initialPassword

      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: payload,
      })

      if (error) {
        let msg = error.message
        if (typeof (error as any).context?.json === 'function') {
          try {
            const json = await (error as any).context.json()
            if (json?.error) msg = json.error
          } catch {
            // ignore
          }
        }
        throw new Error(msg || 'Failed to create user')
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
  })
}
