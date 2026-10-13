import { useEffect } from 'react'
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

async function extractEdgeFunctionError(error: any, defaultMsg: string): Promise<string> {
  const context = error?.context
  if (context) {
    if (context.status === 503 || context.status === 502) {
      return 'Dịch vụ Edge Function chưa sẵn sàng hoặc chưa được khởi chạy (503 Service Unavailable). Hãy chạy "pnpm dev:functions" trong môi trường cục bộ.'
    }
    if (typeof context.json === 'function') {
      try {
        const json = await context.json()
        if (json?.error) return json.error
        if (json?.message) return json.message
      } catch {
        // ignore
      }
    }
    if (typeof context.text === 'function') {
      try {
        const text = await context.text()
        if (text) return text
      } catch {
        // ignore
      }
    }
  }
  return error?.message || defaultMsg
}

export async function fetchAdminStats(): Promise<AdminStatsResponse> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { stats: true },
  })

  if (error) {
    const msg = await extractEdgeFunctionError(error, 'Failed to fetch admin stats')
    throw new Error(msg)
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
    const msg = await extractEdgeFunctionError(error, 'Failed to fetch admin users')
    throw new Error(msg)
  }

  return data as AdminUsersResponse
}

/**
 * Hook to keep admin queries in sync via Supabase Realtime with debounce.
 * Batches incoming mutations to avoid hammering Edge Functions.
 */
export function useAdminRealtimeSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!supabase || typeof (supabase as any).channel !== 'function') return

    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const handleSync = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
        queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      }, 1500)
    }

    const channel = (supabase as any)
      .channel(`admin-realtime-${Math.random().toString(36).slice(2, 7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, handleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, handleSync)
      .subscribe()

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      if (channel && typeof (supabase as any).removeChannel === 'function') {
        (supabase as any).removeChannel(channel)
      }
    }
  }, [queryClient])
}

export function useAdminStats() {
  useAdminRealtimeSync()

  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: fetchAdminStats,
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}

export function useAdminUsers(params: AdminUsersFilterParams = {}) {
  useAdminRealtimeSync()

  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => fetchAdminUsers(params),
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
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
        const msg = await extractEdgeFunctionError(error, `Failed to ${action} user`)
        throw new Error(msg)
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
        const msg = await extractEdgeFunctionError(error, 'Failed to create user')
        throw new Error(msg)
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
  })
}
