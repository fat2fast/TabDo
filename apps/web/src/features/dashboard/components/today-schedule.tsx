import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatInTimeZone } from 'date-fns-tz'
import type { TodayScheduleItem } from '../types'
import { useI18n } from '../../i18n/i18n-provider'
import { DashboardEmptyState } from './dashboard-empty-state'

interface TodayScheduleProps {
  schedule: TodayScheduleItem[]
  timeZone: string
}

export function TodaySchedule({ schedule, timeZone }: TodayScheduleProps) {
  const { t } = useI18n()
  const navigate = useNavigate()

  return (
    <section className="card dashboard-section" aria-label={t('dashboard.todaySchedule')}>
      <div className="section-header">
        <div>
          <h3 className="section-title">{t('dashboard.todaySchedule')}</h3>
          <p className="section-subtitle">{t('dashboard.todayScheduleSubtitle')}</p>
        </div>
        <Link to="/calendar" className="section-link dashboard-action-btn">
          <span>{t('dashboard.viewSchedule')}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>

      {schedule.length === 0 ? (
        <DashboardEmptyState type="schedule" />
      ) : (
        <ul className="dashboard-schedule-list" role="list">
          {schedule.map((item) => {
            const startStr = formatInTimeZone(new Date(item.startAt), timeZone, 'HH:mm')
            const endStr = formatInTimeZone(new Date(item.endAt), timeZone, 'HH:mm')
            const isCompleted = item.taskStatus === 'done'

            return (
              <li
                key={item.id}
                className={`dashboard-schedule-item ${isCompleted ? 'is-completed' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (item.taskId) {
                    navigate(`/tasks/today?taskId=${item.taskId}`)
                  } else {
                    navigate('/calendar')
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    if (item.taskId) {
                      navigate(`/tasks/today?taskId=${item.taskId}`)
                    } else {
                      navigate('/calendar')
                    }
                  }
                }}
              >
                <div className="schedule-time-col">
                  <span className="schedule-time">{startStr}</span>
                  <span className="schedule-time-divider">-</span>
                  <span className="schedule-time">{endStr}</span>
                </div>

                <div className="schedule-content-col">
                  <span className={`schedule-title ${isCompleted ? 'line-through' : ''}`}>
                    {item.title}
                  </span>
                  {item.taskTitle && item.taskTitle !== item.title && (
                    <span className="schedule-task-subtitle">
                      ↳ {item.taskTitle}
                    </span>
                  )}
                </div>

                {item.taskId && (
                  <div className="schedule-status-col">
                    {isCompleted ? (
                      <span className="status-badge status-done">✓ Đã xong</span>
                    ) : (
                      <span className="status-badge status-todo">Chưa xong</span>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
