import React, { useEffect, useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from './auth-provider'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { refetchOnWindowFocus: false },
      mutations: { networkMode: 'always', retry: false },
    },
  })
}

export function UserScopedQueryProvider({ children }: { children: React.ReactNode }) {
  const { user, identityGeneration } = useAuth()
  const key = `${user?.id ?? 'anonymous'}:${identityGeneration}`
  const client = useMemo(createQueryClient, [key])

  useEffect(() => () => {
    void client.cancelQueries()
    client.clear()
  }, [client])

  return <QueryClientProvider key={key} client={client}>{children}</QueryClientProvider>
}
