import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RecurrenceSelector } from '../components/recurrence-selector'

describe('RecurrenceSelector Component', () => {
  it('renders disabled state with localized warning when hasDueDate is false', () => {
    const onChange = vi.fn()
    render(
      <RecurrenceSelector
        value={null}
        onChange={onChange}
        hasDueDate={false}
      />
    )

    const select = screen.getByTestId('recurrence-type-select') as HTMLSelectElement
    expect(select.disabled).toBe(true)

    expect(screen.getByTestId('recurrence-no-due-date-error')).toHaveTextContent(
      'Cần đặt ngày đến hạn trước khi thiết lập lặp lại'
    )
  })

  it('renders subtask disabled notice when isSubtask is true', () => {
    const onChange = vi.fn()
    render(
      <RecurrenceSelector
        value={null}
        onChange={onChange}
        hasDueDate={true}
        isSubtask={true}
      />
    )

    expect(screen.getByTestId('recurrence-subtask-disabled')).toHaveTextContent(
      'Công việc phụ không hỗ trợ lặp lại'
    )
    expect(screen.queryByTestId('recurrence-type-select')).toBeNull()
  })

  it('selects Daily and Weekdays and triggers onChange with canonical RRULE', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <RecurrenceSelector
        value={null}
        onChange={onChange}
        hasDueDate={true}
      />
    )

    const select = screen.getByTestId('recurrence-type-select') as HTMLSelectElement
    expect(select.value).toBe('none')

    fireEvent.change(select, { target: { value: 'daily' } })
    expect(onChange).toHaveBeenCalledWith('FREQ=DAILY')

    rerender(
      <RecurrenceSelector
        value="FREQ=DAILY"
        onChange={onChange}
        hasDueDate={true}
      />
    )
    expect(select.value).toBe('daily')

    fireEvent.change(select, { target: { value: 'weekdays' } })
    expect(onChange).toHaveBeenCalledWith('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')
  })

  it('renders custom weekdays picker and toggles days canonically', () => {
    const onChange = vi.fn()
    render(
      <RecurrenceSelector
        value="FREQ=WEEKLY;BYDAY=MO,WE"
        onChange={onChange}
        hasDueDate={true}
      />
    )

    expect(screen.getByTestId('custom-weekdays-picker')).toBeDefined()
    const toggleMo = screen.getByTestId('weekday-toggle-MO')
    const toggleTu = screen.getByTestId('weekday-toggle-TU')
    const toggleWe = screen.getByTestId('weekday-toggle-WE')

    expect(toggleMo.getAttribute('aria-pressed')).toBe('true')
    expect(toggleTu.getAttribute('aria-pressed')).toBe('false')
    expect(toggleWe.getAttribute('aria-pressed')).toBe('true')

    // Click T3 (TU) to add Tuesday -> MO, TU, WE
    fireEvent.click(toggleTu)
    expect(onChange).toHaveBeenCalledWith('FREQ=WEEKLY;BYDAY=MO,TU,WE')
  })

  it('clears recurrence to null when "none" is chosen', () => {
    const onChange = vi.fn()
    render(
      <RecurrenceSelector
        value="FREQ=MONTHLY"
        onChange={onChange}
        hasDueDate={true}
      />
    )

    const select = screen.getByTestId('recurrence-type-select')
    fireEvent.change(select, { target: { value: 'none' } })
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
