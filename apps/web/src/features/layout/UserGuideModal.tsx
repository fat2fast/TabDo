import React from 'react'
import { useI18n } from '../i18n/i18n-provider'

interface UserGuideModalProps {
  isOpen: boolean
  onClose: () => void
}

export function UserGuideModal({ isOpen, onClose }: UserGuideModalProps) {
  const { t } = useI18n()

  if (!isOpen) return null

  return (
    <div className="user-guide-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="user-guide-modal card" onClick={(e) => e.stopPropagation()}>
        <div className="user-guide-header">
          <div className="user-guide-title-block">
            <span className="user-guide-icon">📖</span>
            <div>
              <h3>{t('guide.title')}</h3>
              <p>{t('guide.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            className="guide-close-btn"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            &times;
          </button>
        </div>

        <div className="user-guide-body">
          <div className="guide-card-item">
            <div className="guide-item-icon">📥</div>
            <div className="guide-item-content">
              <h4>{t('guide.smartViewsTitle')}</h4>
              <p>{t('guide.smartViewsDesc')}</p>
            </div>
          </div>

          <div className="guide-card-item">
            <div className="guide-item-icon">📅</div>
            <div className="guide-item-content">
              <h4>{t('guide.calendarTitle')}</h4>
              <p>{t('guide.calendarDesc')}</p>
            </div>
          </div>

          <div className="guide-card-item">
            <div className="guide-item-icon">🛡️</div>
            <div className="guide-item-content">
              <h4>{t('guide.securityTitle')}</h4>
              <p>{t('guide.securityDesc')}</p>
            </div>
          </div>
        </div>

        <div className="user-guide-footer">
          <button
            type="button"
            className="guide-confirm-btn"
            onClick={onClose}
          >
            {t('guide.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
