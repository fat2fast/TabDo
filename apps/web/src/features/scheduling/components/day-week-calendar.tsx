import React, { useEffect, useMemo, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import interactionPlugin, { type EventResizeDoneArg } from '@fullcalendar/interaction'
import momentTimezonePlugin from '@fullcalendar/moment-timezone'
import timeGridPlugin from '@fullcalendar/timegrid'
import type { DateSelectArg, EventClickArg, EventDropArg } from '@fullcalendar/core'
import type { ScheduleBlock } from '../types'

export interface DayWeekCalendarProps {
  events: ScheduleBlock[]
  view: 'day' | 'week'
  currentDate: string // YYYY-MM-DD
  timeZone: string
  onSelectSlot?: (info: { startAt: string; endAt: string }) => void
  onEventClick?: (block: ScheduleBlock) => void
  onEventDrop?: (info: {
    block: ScheduleBlock
    newStartAt: string
    newEndAt: string
    revert: () => void
  }) => void
  onEventResize?: (info: {
    block: ScheduleBlock
    newStartAt: string
    newEndAt: string
    revert: () => void
  }) => void
}

export function DayWeekCalendar({
  events,
  view,
  currentDate,
  timeZone,
  onSelectSlot,
  onEventClick,
  onEventDrop,
  onEventResize,
}: DayWeekCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null)

  const calendarEvents = useMemo(() => {
    return events.map((block) => ({
      id: block.id,
      title: block.title,
      start: block.startAt,
      end: block.endAt,
      extendedProps: { block },
      classNames: [
        'tabdo-calendar-event',
        block.taskId ? 'tabdo-event-with-task' : 'tabdo-event-independent',
      ],
    }))
  }, [events])

  // Sync calendar view and date when route or props change
  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (!api) return

    const targetView = view === 'day' ? 'timeGridDay' : 'timeGridWeek'
    if (api.view.type !== targetView) {
      api.changeView(targetView)
    }

    if (currentDate) {
      api.gotoDate(currentDate)
    }
  }, [view, currentDate])

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    if (!onSelectSlot) return
    const startAt = selectInfo.start.toISOString()
    const endAt = selectInfo.end.toISOString()
    onSelectSlot({ startAt, endAt })
  }

  const handleEventClick = (clickInfo: EventClickArg) => {
    const block = clickInfo.event.extendedProps.block as ScheduleBlock
    if (block && onEventClick) {
      onEventClick(block)
    }
  }

  const handleEventDrop = (dropInfo: EventDropArg) => {
    const block = dropInfo.event.extendedProps.block as ScheduleBlock
    if (!block || !onEventDrop) return
    if (!dropInfo.event.start || !dropInfo.event.end) {
      dropInfo.revert()
      return
    }
    const newStartAt = dropInfo.event.start.toISOString()
    const newEndAt = dropInfo.event.end.toISOString()
    onEventDrop({
      block,
      newStartAt,
      newEndAt,
      revert: dropInfo.revert,
    })
  }

  const handleEventResize = (resizeInfo: EventResizeDoneArg) => {
    const block = resizeInfo.event.extendedProps.block as ScheduleBlock
    if (!block || !onEventResize) return
    if (!resizeInfo.event.start || !resizeInfo.event.end) {
      resizeInfo.revert()
      return
    }
    const newStartAt = resizeInfo.event.start.toISOString()
    const newEndAt = resizeInfo.event.end.toISOString()
    onEventResize({
      block,
      newStartAt,
      newEndAt,
      revert: resizeInfo.revert,
    })
  }

  return (
    <div className="tabdo-day-week-calendar-wrapper" data-testid="day-week-calendar">
      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, interactionPlugin, momentTimezonePlugin]}
        initialView={view === 'day' ? 'timeGridDay' : 'timeGridWeek'}
        initialDate={currentDate}
        timeZone={timeZone}
        headerToolbar={false}
        firstDay={1} // Monday
        allDaySlot={false}
        editable={true}
        selectable={true}
        selectMirror={true}
        dayMaxEvents={true}
        nowIndicator={true}
        slotMinTime="06:00:00"
        slotMaxTime="24:00:00"
        slotDuration="00:30:00"
        slotLabelInterval="01:00"
        dayHeaderContent={(arg) => {
          const weekdayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
          const weekdayShort = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
          const dayOfWeek = arg.date.getDay()
          const d = arg.date.getDate()
          const m = arg.date.getMonth() + 1
          const isToday = arg.isToday

          return (
            <div className={`tabdo-fc-header-cell ${isToday ? 'is-today' : ''}`}>
              <span className="fc-header-weekday">
                {view === 'day' ? weekdayNames[dayOfWeek] : weekdayShort[dayOfWeek]}
              </span>
              <span className={`fc-header-daynumber ${isToday ? 'today-badge' : ''}`}>
                {view === 'day' ? `${d} tháng ${m}` : d}
              </span>
            </div>
          )
        }}
        events={calendarEvents}
        select={handleDateSelect}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        height="100%"
        eventContent={(arg) => {
          const block = arg.event.extendedProps.block as ScheduleBlock
          return (
            <div className="tabdo-fc-event-inner">
              <div className="tabdo-fc-event-time">{arg.timeText}</div>
              <div className="tabdo-fc-event-title">{arg.event.title}</div>
              {block?.taskId && (
                <span className="tabdo-fc-event-badge" title="Đã liên kết với công việc">
                  🔗
                </span>
              )}
            </div>
          )
        }}
      />
    </div>
  )
}
