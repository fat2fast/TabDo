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
