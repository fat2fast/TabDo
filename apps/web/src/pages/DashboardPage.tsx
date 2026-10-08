import React from 'react'
import { useI18n } from '../features/i18n/i18n-provider'

export function DashboardPage() {
  const { t } = useI18n()
  return (
    <section className="card">
      <h2>{t('nav.dashboard')}</h2>
      <p>{t('dashboard.welcome')}</p>
    </section>
  )
}

