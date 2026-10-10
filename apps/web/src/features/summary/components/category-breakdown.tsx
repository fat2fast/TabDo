import React from 'react'
import { useI18n } from '../../i18n/i18n-provider'
import type { CategorySummaryItem } from '../types'

export interface CategoryBreakdownProps {
  categories: CategorySummaryItem[]
  totalCompleted: number
}

export function CategoryBreakdown({
  categories,
  totalCompleted,
}: CategoryBreakdownProps) {
  const { t } = useI18n()

  return (
    <div className="card summary-section-card" data-testid="summary-category-breakdown">
      <div className="summary-section-header">
        <h3 className="summary-section-title">{t('summary.categoryBreakdownTitle')}</h3>
      </div>

      {categories.length === 0 ? (
        <div className="summary-empty-state">
          <p className="summary-empty-text">{t('summary.categoryEmpty')}</p>
        </div>
      ) : (
        <div className="summary-category-list">
          {categories.map((cat) => {
            const displayName = cat.isUncategorized
              ? t('categories.uncategorized')
              : cat.name
            const percentage =
              totalCompleted > 0 ? Math.round((cat.count / totalCompleted) * 100) : 0

            return (
              <div
                key={cat.categoryId ?? 'uncategorized'}
                className="summary-category-item"
                data-testid={`category-item-${cat.categoryId ?? 'uncategorized'}`}
              >
                <div className="summary-category-info">
                  <span
                    className="summary-category-dot"
                    style={{ backgroundColor: cat.color || '#94a3b8' }}
                    aria-hidden="true"
                  />
                  <span className="summary-category-name">{displayName}</span>
                  <span className="summary-category-count">
                    {cat.count} ({percentage}%)
                  </span>
                </div>
                <div className="summary-category-bar-track">
                  <div
                    className="summary-category-bar-fill"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: cat.color || '#94a3b8',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
