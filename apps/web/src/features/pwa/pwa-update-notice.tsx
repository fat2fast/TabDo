import React, { useSyncExternalStore } from 'react'
import { useConfirm } from '../../components/ui/confirm-dialog'
import { getPendingWrites, subscribeWrites } from '../../lib/write-safety'
import { useI18n } from '../i18n/i18n-provider'
import { usePwaUpdate } from './pwa-update-context'
import { activateUpdate, getUpdateState, reloadUpdatedWindow, retryRegistration } from './use-pwa-registration'

export function PwaUpdateNotice() {
  const { state, error } = usePwaUpdate()
  const pending = useSyncExternalStore(subscribeWrites, getPendingWrites, getPendingWrites)
  const confirm = useConfirm()
  const { t } = useI18n()
  if (state === 'idle') return error ? <aside className="pwa-notice" role="alert"><p>{t('pwa.updateError')}</p><button type="button" className="btn btn-secondary" onClick={retryRegistration}>{t('common.retry')}</button></aside> : null
  const changed = state === 'controller-changed-needs-reload'
  const handleUpdate = async () => {
    if (pending) return
    const accepted = await confirm({ title: t('pwa.updateTitle'), message: t('pwa.updateDescription'), variant: 'warning', confirmText: changed ? t('pwa.reload') : t('pwa.update') })
    if (!accepted || getPendingWrites() !== 0) return
    if (getUpdateState() === 'controller-changed-needs-reload') reloadUpdatedWindow()
    else if (getUpdateState() === 'waiting') void activateUpdate()
  }
  return <aside className="pwa-notice pwa-update-notice" role="status">
    <div><strong>{t('pwa.updateTitle')}</strong><p>{changed ? t('pwa.versionChanged') : t('pwa.updateDescription')}</p>{pending > 0 && <p>{t('pwa.pending')} ({pending})</p>}{error && <p role="alert">{t('pwa.updateError')}</p>}</div>
    <button type="button" className="btn btn-secondary" disabled={pending > 0 || state === 'activation-requested-locally'} onClick={() => void handleUpdate()}>{changed ? t('pwa.reload') : t('pwa.update')}</button>
  </aside>
}
