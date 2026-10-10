import { useState, useCallback } from 'react'

const STORAGE_KEY = 'tabdo:sidebar:collapsed'

export function useSidebarCollapse() {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        return localStorage.getItem(STORAGE_KEY) === 'true'
      }
    } catch {
      // ignore in SSR or restricted environments
    }
    return false
  })

  const toggleSidebar = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, String(next))
        }
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  return { isCollapsed, toggleSidebar }
}
