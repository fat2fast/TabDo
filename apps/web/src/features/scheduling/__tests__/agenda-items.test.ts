import { describe, expect, it } from 'vitest'
import { buildAgendaItems } from '../utils/agenda-items'
import type { ScheduleBlock } from '../types'

describe('agenda-items utility', () => {
  const timeZone = 'Asia/Ho_Chi_Minh'
  const visibleRange = {
    startAt: '2026-10-23T00:00:00.000Z',
    endAt: '2026-10-25T00:00:00.000Z',
  }

  const baseBlock: ScheduleBlock = {
    id: 'block-1',
    userId: 'user-1',
    taskId: null,
    title: 'Họp chiến lược',
    startAt: '2026-10-23T02:00:00.000Z', // 09:00 VN
    endAt: '2026-10-23T03:30:00.000Z',   // 10:30 VN
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-20T00:00:00.000Z',
  }

  it('groups single-day blocks correctly under local date', () => {
    const groups = buildAgendaItems([baseBlock], visibleRange, timeZone)
    expect(groups).toHaveLength(1)
    expect(groups[0].dateStr).toBe('2026-10-23')
    expect(groups[0].items).toHaveLength(1)
    expect(groups[0].items[0].startTime).toBe('09:00')
    expect(groups[0].items[0].endTime).toBe('10:30')
    expect(groups[0].items[0].blockId).toBe('block-1')
    expect(groups[0].items[0].block).toBe(baseBlock)
  })

  it('splits midnight-crossing block into two day segments sharing the exact same block reference and id', () => {
    // 22:00 VN on Oct 23 is 15:00 UTC. 02:00 VN on Oct 24 is 19:00 UTC Oct 23.
    const midnightBlock: ScheduleBlock = {
      ...baseBlock,
      id: 'block-midnight',
      title: 'Trực hệ thống ca đêm',
      startAt: '2026-10-23T15:00:00.000Z', // 22:00 VN Oct 23
      endAt: '2026-10-23T19:00:00.000Z',   // 02:00 VN Oct 24
    }

    const groups = buildAgendaItems([midnightBlock], visibleRange, timeZone)
    expect(groups).toHaveLength(2)

    // Segment 1 on Oct 23
    expect(groups[0].dateStr).toBe('2026-10-23')
    expect(groups[0].items[0].startTime).toBe('22:00')
    expect(groups[0].items[0].endTime).toBe('23:59')
    expect(groups[0].items[0].spansNextDay).toBe(true)
    expect(groups[0].items[0].isSpillover).toBe(false)
    expect(groups[0].items[0].blockId).toBe('block-midnight')
    expect(groups[0].items[0].block).toBe(midnightBlock)

    // Segment 2 on Oct 24
    expect(groups[1].dateStr).toBe('2026-10-24')
    expect(groups[1].items[0].startTime).toBe('00:00')
    expect(groups[1].items[0].endTime).toBe('02:00')
    expect(groups[1].items[0].spansNextDay).toBe(false)
    expect(groups[1].items[0].isSpillover).toBe(true)
    expect(groups[1].items[0].blockId).toBe('block-midnight')
    expect(groups[1].items[0].block).toBe(midnightBlock)
  })

  it('strictly clamps midnight-crossing block segments into visible range (Finding 2)', () => {
    // Block runs from 22:00 Oct 23 VN (15:00 UTC) to 02:00 Oct 24 VN (19:00 UTC)
    const midnightBlock: ScheduleBlock = {
      ...baseBlock,
      id: 'block-midnight',
      title: 'Trực đêm',
      startAt: '2026-10-23T15:00:00.000Z',
      endAt: '2026-10-23T19:00:00.000Z',
    }

    // Visible range is Day 24/10 only in VN: 2026-10-23T17:00:00Z to 2026-10-24T17:00:00Z
    const day24Range = {
      startAt: '2026-10-23T17:00:00.000Z',
      endAt: '2026-10-24T17:00:00.000Z',
    }

    const groups = buildAgendaItems([midnightBlock], day24Range, timeZone)
    // Must ONLY include 2026-10-24, clamping out 2026-10-23
    expect(groups).toHaveLength(1)
    expect(groups[0].dateStr).toBe('2026-10-24')
    expect(groups[0].items).toHaveLength(1)
    expect(groups[0].items[0].startTime).toBe('00:00')
    expect(groups[0].items[0].endTime).toBe('02:00')
    expect(groups[0].items[0].isSpillover).toBe(true)
    expect(groups[0].items[0].spansNextDay).toBe(false)

    // And vice-versa: Visible range is Day 23/10 only in VN: 2026-10-22T17:00:00Z to 2026-10-23T17:00:00Z
    const day23Range = {
      startAt: '2026-10-22T17:00:00.000Z',
      endAt: '2026-10-23T17:00:00.000Z',
    }

    const groups23 = buildAgendaItems([midnightBlock], day23Range, timeZone)
    // Must ONLY include 2026-10-23, clamping out 2026-10-24
    expect(groups23).toHaveLength(1)
    expect(groups23[0].dateStr).toBe('2026-10-23')
    expect(groups23[0].items).toHaveLength(1)
    expect(groups23[0].items[0].startTime).toBe('22:00')
    expect(groups23[0].items[0].endTime).toBe('23:59')
    expect(groups23[0].items[0].isSpillover).toBe(false)
    expect(groups23[0].items[0].spansNextDay).toBe(true)
  })

  it('guarantees date label matches dateStr regardless of machine timezone (Finding 1)', () => {
    // Test that dayLabel format matches the dateStr day exactly (23/10/2026)
    const groups = buildAgendaItems([baseBlock], visibleRange, timeZone)
    expect(groups).toHaveLength(1)
    expect(groups[0].dateStr).toBe('2026-10-23')
    expect(groups[0].dayLabel).toContain('23/10/2026')
  })

  it('clips blocks that fall completely outside visible range', () => {
    const outsideBlock: ScheduleBlock = {
      ...baseBlock,
      id: 'block-outside',
      startAt: '2026-10-26T02:00:00.000Z',
      endAt: '2026-10-26T04:00:00.000Z',
    }

    const groups = buildAgendaItems([outsideBlock], visibleRange, timeZone)
    expect(groups).toHaveLength(0)
  })

  it('sorts items deterministically by startTime, endTime, and blockId', () => {
    const blockA: ScheduleBlock = {
      ...baseBlock,
      id: 'block-a',
      title: 'Ca sáng',
      startAt: '2026-10-23T01:00:00.000Z', // 08:00 VN
      endAt: '2026-10-23T03:00:00.000Z',   // 10:00 VN
    }
    const blockB: ScheduleBlock = {
      ...baseBlock,
      id: 'block-b',
      title: 'Ca trưa',
      startAt: '2026-10-23T05:00:00.000Z', // 12:00 VN
      endAt: '2026-10-23T06:00:00.000Z',   // 13:00 VN
    }
    const blockC: ScheduleBlock = {
      ...baseBlock,
      id: 'block-c',
      title: 'Ca sáng sớm',
      startAt: '2026-10-23T00:00:00.000Z', // 07:00 VN
      endAt: '2026-10-23T01:00:00.000Z',   // 08:00 VN
    }

    // Input in random order: B, A, C
    const groups = buildAgendaItems([blockB, blockA, blockC], visibleRange, timeZone)
    expect(groups[0].items.map((i) => i.blockId)).toEqual(['block-c', 'block-a', 'block-b'])
  })

  it('correctly groups according to specified DST timezone', () => {
    const nyTz = 'America/New_York'
    // 2026-10-23 14:00 UTC is 10:00 EDT in New York
    const nyBlock: ScheduleBlock = {
      ...baseBlock,
      id: 'block-ny',
      startAt: '2026-10-23T14:00:00.000Z',
      endAt: '2026-10-23T15:00:00.000Z',
    }
    const groups = buildAgendaItems([nyBlock], visibleRange, nyTz)
    expect(groups).toHaveLength(1)
    expect(groups[0].items[0].startTime).toBe('10:00')
    expect(groups[0].items[0].endTime).toBe('11:00')
    expect(groups[0].dayLabel).toContain('23/10/2026')
  })
})
