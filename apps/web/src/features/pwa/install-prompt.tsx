import React, { useSyncExternalStore } from 'react'
import { useAuth } from '../auth/auth-provider'
import { useI18n } from '../i18n/i18n-provider'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
interface InstallState { eligible: boolean; installed: boolean }
let deferred: BeforeInstallPromptEvent | null = null
let dismissed = false
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
let state: InstallState = { eligible: false, installed: typeof window !== 'undefined' && standalone() }
const listeners = new Set<() => void>()
function publish() {
  const installed = state.installed || standalone()
  state = { eligible: Boolean(deferred) && !dismissed && !installed, installed }
  listeners.forEach(listener => listener())
}
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    publish()
  })
  window.addEventListener('appinstalled', () => { deferred = null; state = { eligible: false, installed: true }; publish() })
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', publish)
}
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function useInstallState() { return useSyncExternalStore(subscribe, () => state, () => state) }
export async function promptInstall() {
  const prompt = deferred
  if (!prompt) return
  deferred = null
  dismissed = true
  publish()
  await prompt.prompt()
  await prompt.userChoice
}

export function InstallPrompt() {
  const { eligible } = useInstallState()
  const { user, profile, isAuthLoading, isProfileLoading, authError, profileError } = useAuth()
  const { t } = useI18n()
  if (!eligible || !user || !profile || profile.id !== user.id || !profile.isActive || profile.mustChangePassword || isAuthLoading || isProfileLoading || authError || profileError) return null
  return <aside className="pwa-notice" role="status"><div><strong>{t('pwa.installTitle')}</strong><p>{t('pwa.installDescription')}</p></div><button type="button" className="btn btn-secondary" onClick={() => void promptInstall()}>{t('pwa.install')}</button></aside>
}
