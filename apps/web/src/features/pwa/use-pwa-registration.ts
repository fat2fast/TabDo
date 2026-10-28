import { useEffect, useSyncExternalStore } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { getPendingWrites, setWritesFrozen, subscribeWrites } from '../../lib/write-safety'
import { reloadPage } from './pwa-browser'

export type UpdateState = 'idle' | 'waiting' | 'activation-requested-locally' | 'controller-changed-needs-reload'
interface Snapshot { state: UpdateState; error: boolean }
let snapshot: Snapshot = { state: 'idle', error: false }
const listeners = new Set<() => void>()
let started = false
let updateWorker: (() => Promise<void>) | undefined
let registration: ServiceWorkerRegistration | undefined
let controller: ServiceWorker | null = null
let localConsent = false
let reloaded = false
let watchdog: ReturnType<typeof setTimeout> | undefined
let activationAttempt = 0
let lastUpdateCheck = 0
let checking = false
let registrationAttempt = 0

function getSnapshot(): Snapshot { return snapshot }
export function getUpdateState() { return snapshot.state }
export function isUpdateReloading() { return reloaded }
function requestReload() {
  if (reloaded) return
  reloaded = true
  reloadPage()
  // If navigation is interrupted, the user can try again without losing the draft.
  setTimeout(() => { reloaded = false }, 2_000)
}

function publish(next: Snapshot) {
  snapshot = next
  listeners.forEach(listener => listener())
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
function reloadAfterLocalConsent() {
  if (snapshot.state === 'controller-changed-needs-reload' && localConsent && !reloaded && getPendingWrites() === 0) {
    requestReload()
  }
}
function controllerChanged() {
  const current = navigator.serviceWorker?.controller ?? null
  if (!current || current === controller) return
  const initial = controller === null
  controller = current
  if (initial && !localConsent) return
  clearTimeout(watchdog)
  setWritesFrozen(true)
  publish({ state: 'controller-changed-needs-reload', error: false })
  reloadAfterLocalConsent()
}

function startRegistration() {
  if (started || !('serviceWorker' in navigator)) return
  started = true
  const attempt = ++registrationAttempt
  controller = navigator.serviceWorker.controller
  updateWorker = registerSW({
    immediate: true,
    onNeedRefresh: () => {
      if (snapshot.state === 'idle') publish({ state: 'waiting', error: false })
    },
    onNeedReload: controllerChanged,
    onRegisteredSW: (_url, value) => {
      if (attempt !== registrationAttempt) return
      registration = value
      publish({ ...snapshot, error: false })
    },
    onRegisterError: () => {
      if (attempt !== registrationAttempt) return
      started = false
      registration = undefined
      publish({ ...snapshot, error: true })
    },
  })
}

export function retryRegistration() { startRegistration() }

export async function activateUpdate() {
  if (snapshot.state !== 'waiting' || !updateWorker || getPendingWrites() !== 0) return false
  setWritesFrozen(true)
  if (getPendingWrites() !== 0) { setWritesFrozen(false); return false }
  localConsent = true
  const attempt = ++activationAttempt
  publish({ state: 'activation-requested-locally', error: false })
  const prior = controller
  watchdog = setTimeout(() => {
    controllerChanged()
    if (attempt === activationAttempt && getSnapshot().state === 'activation-requested-locally' && navigator.serviceWorker.controller === prior) {
      activationAttempt += 1
      localConsent = false
      setWritesFrozen(false)
      publish({ state: 'waiting', error: true })
    }
  }, 30_000)
  try {
    await updateWorker()
    return true
  } catch {
    controllerChanged()
    if (attempt === activationAttempt && getSnapshot().state === 'activation-requested-locally') {
      clearTimeout(watchdog)
      localConsent = false
      setWritesFrozen(false)
      publish({ state: 'waiting', error: true })
    }
    return false
  }
}

export function reloadUpdatedWindow() {
  if (snapshot.state !== 'controller-changed-needs-reload' || getPendingWrites() !== 0 || reloaded) return
  requestReload()
}

export function usePwaRegistration() {
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  useEffect(() => {
    startRegistration()
    if (!('serviceWorker' in navigator)) return
    const check = () => {
      if (!navigator.onLine || document.visibilityState !== 'visible') return
      if (!started) { startRegistration(); return }
      if (!registration || checking || Date.now() - lastUpdateCheck < 30_000) return
      lastUpdateCheck = Date.now()
      checking = true
      void registration.update().catch(() => {}).finally(() => { checking = false })
    }
    const visible = () => { if (document.visibilityState === 'visible') check() }
    navigator.serviceWorker.addEventListener('controllerchange', controllerChanged)
    const unsubscribeWrites = subscribeWrites(reloadAfterLocalConsent)
    window.addEventListener('online', check)
    document.addEventListener('visibilitychange', visible)
    const timer = setInterval(check, 60 * 60 * 1000)
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', controllerChanged)
      unsubscribeWrites()
      window.removeEventListener('online', check)
      document.removeEventListener('visibilitychange', visible)
      clearInterval(timer)
    }
  }, [])
  return value
}
