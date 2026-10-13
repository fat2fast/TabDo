import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CustomDropdown } from '../custom-dropdown'

describe('CustomDropdown', () => {
  const options = [
    { value: '', label: '-- Không liên kết (Độc lập) --' },
    { value: 'task-1', label: 'Tối ưu CSS Grid cho hiển thị đa kích thước' },
    { value: 'task-2', label: 'Tích hợp xác thực hai yếu tố cho Admin' },
    { value: 'task-3', label: 'Xây dựng kịch bản seed dữ liệu mẫu cục bộ' },
  ]

  it('renders trigger button and opens options listbox when clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <CustomDropdown
        id="test-dropdown"
        testId="test-dropdown"
        value=""
        options={options}
        onChange={onChange}
      />
    )

    const trigger = screen.getByTestId('test-dropdown-trigger')
    expect(trigger).toHaveTextContent('-- Không liên kết (Độc lập) --')

    await user.click(trigger)
    const listbox = screen.getByRole('listbox')
    expect(listbox).toBeInTheDocument()
    expect(within(listbox).getAllByRole('option')).toHaveLength(4)
  })

  it('selects option when clicked and calls onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <CustomDropdown
        id="test-dropdown"
        testId="test-dropdown"
        value=""
        options={options}
        onChange={onChange}
      />
    )

    await user.click(screen.getByTestId('test-dropdown-trigger'))
    const listbox = screen.getByRole('listbox')
    await user.click(within(listbox).getByText('Tích hợp xác thực hai yếu tố cho Admin'))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('task-2')
  })

  it('supports fast search filtering when searchable is true', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <CustomDropdown
        id="test-dropdown"
        testId="test-dropdown"
        value=""
        options={options}
        onChange={onChange}
        searchable={true}
        searchPlaceholder="Tìm kiếm nhanh..."
      />
    )

    await user.click(screen.getByTestId('test-dropdown-trigger'))

    const searchInput = screen.getByTestId('test-dropdown-search-input')
    expect(searchInput).toBeInTheDocument()

    // Type query "CSS"
    await user.type(searchInput, 'CSS')

    const listbox = screen.getByRole('listbox')
    // Only matching option should remain in listbox
    expect(within(listbox).getByText('Tối ưu CSS Grid cho hiển thị đa kích thước')).toBeInTheDocument()
    expect(within(listbox).queryByText('Tích hợp xác thực hai yếu tố cho Admin')).not.toBeInTheDocument()
    expect(within(listbox).queryByText('Xây dựng kịch bản seed dữ liệu mẫu cục bộ')).not.toBeInTheDocument()

    // Type non-matching query
    await user.clear(searchInput)
    await user.type(searchInput, 'xyz123')
    expect(within(listbox).getByText('Không tìm thấy kết quả phù hợp')).toBeInTheDocument()
  })
})
