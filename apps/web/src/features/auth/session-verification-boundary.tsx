import React, { createContext, useContext, useLayoutEffect, useState } from 'react'
import { useAuth } from './auth-provider'

const PortalHostContext = createContext<HTMLElement | null>(null)
export function usePrivatePortalHost() { return useContext(PortalHostContext) }

export function SessionVerificationBoundary({ children }: { children: React.ReactNode }) {
  const { sessionVerification, retrySession } = useAuth()
  const [portalHost, setPortalHost] = useState<HTMLDivElement | null>(null)
  const blocked = sessionVerification !== 'ready'
  useLayoutEffect(() => {
    if (!blocked) return
    const stopBackgroundInput = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape' && event.key !== 'Tab') return
      event.stopImmediatePropagation()
      if (event instanceof KeyboardEvent && event.key === 'Escape') event.preventDefault()
    }
    window.addEventListener('keydown', stopBackgroundInput, true)
    window.addEventListener('mousedown', stopBackgroundInput, true)
    window.addEventListener('touchstart', stopBackgroundInput, true)
    return () => {
      window.removeEventListener('keydown', stopBackgroundInput, true)
      window.removeEventListener('mousedown', stopBackgroundInput, true)
      window.removeEventListener('touchstart', stopBackgroundInput, true)
    }
  }, [blocked])
  return <>
    <div hidden={blocked} inert={blocked || undefined} aria-hidden={blocked || undefined}>
      <div ref={setPortalHost} />
      <PortalHostContext.Provider value={portalHost}>{children}</PortalHostContext.Provider>
    </div>
    {blocked && <div className="auth-error-state" role={sessionVerification === 'error' ? 'alert' : 'status'}>
      <p>{sessionVerification === 'error' ? 'Không thể xác minh phiên đăng nhập. Vui lòng thử lại.' : 'Đang xác minh phiên đăng nhập...'}</p>
      {sessionVerification === 'error' && <button type="button" onClick={retrySession}>Thử lại</button>}
    </div>}
  </>
}
