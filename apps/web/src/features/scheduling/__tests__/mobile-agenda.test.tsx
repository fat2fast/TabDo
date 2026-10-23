import React from 'react'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MobileAgenda } from '../components/mobile-agenda'
import type { ScheduleBlock } from '../types'

describe('MobileAgenda component', () => {
  const timeZone = 'Asia/Ho_Chi_Minh'
  const visibleRange = {
    startAt: '2026-10-23T00:00:00.000Z',
    endAt: '2026-10-25T00:00:00.000Z',
  }

  const sampleBlock: ScheduleBlock = {
    id: 'block-test-1',
    userId: 'user-1',
    taskId: 'task-link-1',
    title: 'Đánh giá kiến trúc',
    startAt: '2026-10-23T02:00:00.000Z', // 09:00 VN
    endAt: '2026-10-23T04:00:00.000Z',   // 11:00 VN
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-20T00:00:00.000Z',
  }

  it('renders empty state when blocks array is empty', () => {
    render(
      <MobileAgenda
        blocks={[]}
        visibleRange={visibleRange}
        timeZone={timeZone}
        onEventClick={vi.fn()}
      />
    )
    expect(screen.getByTestId('mobile-agenda-empty')).toBeInTheDocument()
    expect(screen.getByText('Không có lịch làm việc')).toBeInTheDocument()
  })

  it('renders day groups and block cards with time and title', () => {
    render(
      <MobileAgenda
        blocks={[sampleBlock]}
        visibleRange={visibleRange}
        timeZone={timeZone}
        onEventClick={vi.fn()}
      />
    )
    expect(screen.getByTestId('mobile-agenda')).toBeInTheDocument()
    expect(screen.getByText('Đánh giá kiến trúc')).toBeInTheDocument()
    expect(screen.getByText('09:00')).toBeInTheDocument()
    expect(screen.getByText('11:00')).toBeInTheDocument()
    expect(screen.getByText(/Đã gắn công việc/i)).toBeInTheDocument()
  })

  it('triggers onEventClick with original block on click and Enter key', async () => {
    const user = userEvent.setup()
    const onEventClick = vi.fn()

    render(
      <MobileAgenda
        blocks={[sampleBlock]}
        visibleRange={visibleRange}
        timeZone={timeZone}
        onEventClick={onEventClick}
      />
    )

    const card = screen.getByTestId('agenda-item-block-test-1')
    await user.click(card)
    expect(onEventClick).toHaveBeenCalledWith(sampleBlock)

    // Keyboard Enter
    card.focus()
    await user.keyboard('{Enter}')
    expect(onEventClick).toHaveBeenCalledTimes(2)
  })
})
