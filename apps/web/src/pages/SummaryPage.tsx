import React from 'react'
import { useI18n } from '../features/i18n/i18n-provider'

export function SummaryPage() {
  const { t } = useI18n()
  return (
    <section className="card">
      <h2>{t('nav.summary')}</h2>
      <p>{t('summary.welcome')}</p>
    </section>
  )
}

