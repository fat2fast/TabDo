import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { usePwaUpdate } from './pwa-update-context'
import { isUpdateReloading } from './use-pwa-registration'

export function useVersionNavigationGuard() {
  const location = useLocation()
  const { state } = usePwaUpdate()
  const frozen = state === 'controller-changed-needs-reload'
  const previous = useRef(location)
  if (!frozen) previous.current = location
  useEffect(() => {
    if (!frozen) return
    const beforeUnload = (event: BeforeUnloadEvent) => { if (!isUpdateReloading()) { event.preventDefault(); event.returnValue = '' } }
    const preventNavigation = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest('a[href]') as HTMLAnchorElement | null
      if (anchor && new URL(anchor.href, window.location.origin).origin === window.location.origin) event.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', preventNavigation, true)
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', preventNavigation, true) }
  }, [frozen])
  return frozen ? previous.current : location
}
