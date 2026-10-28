import React, { createContext, useContext } from 'react'
import { usePwaRegistration, type UpdateState } from './use-pwa-registration'

const Context = createContext<{ state: UpdateState; error: boolean }>({ state: 'idle', error: false })
export function PwaUpdateProvider({ children }: { children: React.ReactNode }) {
  return <Context.Provider value={usePwaRegistration()}>{children}</Context.Provider>
}
export function usePwaUpdate() { return useContext(Context) }
