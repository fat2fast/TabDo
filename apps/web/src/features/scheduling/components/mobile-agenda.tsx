import React, { useMemo } from 'react'
import type { ScheduleBlock } from '../types'
import { buildAgendaItems } from '../utils/agenda-items'

export interface MobileAgendaProps {
  blocks: ScheduleBlock[]
  visibleRange: { startAt: string; endAt: string }
  timeZone: string
  onEventClick: (block: ScheduleBlock) => void
  onAddSchedule?: () => void
}

export function MobileAgenda({
  blocks,
  visibleRange,
  timeZone,
  onEventClick,
  onAddSchedule,
}: MobileAgendaProps) {
  const dayGroups = useMemo(() => {
    return buildAgendaItems(blocks, visibleRange, timeZone)
  }, [blocks, visibleRange, timeZone])

  if (dayGroups.length === 0) {
    return (
      <div className="mobile-agenda-empty card" data-testid="mobile-agenda-empty">
        <div className="empty-icon-circle">📅</div>
        <h3 className="empty-title">Không có lịch làm việc</h3>
        <p className="empty-desc">
          Chưa có khoảng thời gian nào được lên lịch trong khoảng thời gian này.
        </p>
        {onAddSchedule && (
          <button
            type="button"
            className="btn btn-primary btn-sm add-schedule-empty-btn"
            onClick={onAddSchedule}
          >
            + Lên lịch ngay
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="mobile-agenda-container" data-testid="mobile-agenda">
      {dayGroups.map((group) => (
        <div
          key={group.dateStr}
          className={`agenda-day-group ${group.isToday ? 'is-today' : ''}`}
          data-testid={`agenda-group-${group.dateStr}`}
        >
          <div className="agenda-day-header">
            <span className="agenda-day-title">{group.dayLabel}</span>
            {group.isToday && <span className="agenda-today-badge">Hôm nay</span>}
            <span className="agenda-count-badge">{group.items.length} lịch</span>
          </div>

          <div className="agenda-day-items">
            {group.items.map((item) => (
              <div
                key={item.id}
                className="agenda-item-card"
                onClick={() => onEventClick(item.block)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onEventClick(item.block)
                  }
                }}
                data-testid={`agenda-item-${item.blockId}`}
                style={{
                  borderLeftColor: (item.block as any).color || 'var(--mobile-accent, #0284c7)',
                }}
              >
                <div className="agenda-item-time-col">
                  {item.isAllDay ? (
                    <span className="agenda-time-allday">Cả ngày</span>
                  ) : (
                    <>
                      <span className="agenda-time-start">{item.startTime}</span>
                      <span className="agenda-time-divider">-</span>
                      <span className="agenda-time-end">{item.endTime}</span>
                    </>
                  )}
                  {item.isSpillover && (
                    <span className="agenda-spillover-tag" title="Bắt đầu từ ngày hôm trước">
                      ↳ Tiếp tục
                    </span>
                  )}
                  {item.spansNextDay && (
                    <span className="agenda-spans-tag" title="Kéo dài sang ngày hôm sau">
                      Qua đêm →
                    </span>
                  )}
                </div>

                <div className="agenda-item-content">
                  <h4 className="agenda-item-title">{item.title}</h4>
                  {(item.block as any).description && (
                    <p className="agenda-item-desc">{(item.block as any).description}</p>
                  )}
                  {item.block.taskId && (
                    <span className="agenda-linked-task-pill" title="Lịch gắn với công việc">
                      🔗 Đã gắn công việc
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
