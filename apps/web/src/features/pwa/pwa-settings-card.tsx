import React from 'react'
import { useI18n } from '../i18n/i18n-provider'
import { promptInstall, useInstallState } from './install-prompt'

export function PwaSettingsCard() {
  const { eligible, installed } = useInstallState()
  const { t } = useI18n()
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return <section className="pwa-settings-card card">
    <h2>{t('pwa.installTitle')}</h2>
    <p>{installed ? t('pwa.installed') : t(ios ? 'pwa.installIos' : 'pwa.installBrowser')}</p>
    {eligible && !installed && <button type="button" className="btn btn-secondary" onClick={() => void promptInstall()}>{t('pwa.install')}</button>}
  </section>
}
