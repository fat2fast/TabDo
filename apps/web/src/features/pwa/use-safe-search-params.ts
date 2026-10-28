import { useSearchParams } from 'react-router-dom'
import { useCallback } from 'react'
import { usePwaUpdate } from './pwa-update-context'
import { getUpdateState } from './use-pwa-registration'

export function useSafeSearchParams(...args: Parameters<typeof useSearchParams>): ReturnType<typeof useSearchParams> {
  const [params, setParams] = useSearchParams(...args)
  const { state } = usePwaUpdate()
  const guarded: typeof setParams = useCallback((next, options) => {
    if (state !== 'controller-changed-needs-reload' && getUpdateState() !== 'controller-changed-needs-reload') setParams(next, options)
  }, [state, setParams])
  return [params, guarded]
}
