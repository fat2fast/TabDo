import { useNavigate, type NavigateOptions, type To } from 'react-router-dom'
import { useCallback } from 'react'
import { usePwaUpdate } from './pwa-update-context'
import { getUpdateState } from './use-pwa-registration'

export function useSafeNavigate() {
  const navigate = useNavigate()
  const { state } = usePwaUpdate()
  return useCallback((to: To, options?: NavigateOptions) => {
    if (state !== 'controller-changed-needs-reload' && getUpdateState() !== 'controller-changed-needs-reload') navigate(to, options)
  }, [state, navigate])
}
