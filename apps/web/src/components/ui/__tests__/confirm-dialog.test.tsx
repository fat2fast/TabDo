import React, { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  ConfirmDialog,
  ConfirmProvider,
  useConfirm,
} from '../confirm-dialog'

function TestConfirmConsumer() {
  const confirm = useConfirm()
  const [result, setResult] = useState<string | null>(null)

  const handleAction = async () => {
    const ok = await confirm({
      title: 'Xóa mục này?',
      message: 'Hành động này không thể hoàn tác.',
      confirmText: 'Xóa vĩnh viễn',
      cancelText: 'Bỏ qua',
      variant: 'danger',
    })
    setResult(ok ? 'confirmed' : 'cancelled')
  }

  return (
    <div>
      <button type="button" onClick={handleAction}>
        Kích hoạt xóa
      </button>
      {result && <span data-testid="test-result">{result}</span>}
    </div>
  )
}

describe('ConfirmDialog Component & Hook (UI/UX Pro Max)', () => {
  it('1. ConfirmDialog standalone: renders title, message and dispatches onConfirm and onCancel', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const user = userEvent.setup()

    const { rerender } = render(
      <ConfirmDialog
        isOpen={true}
        title="Xác nhận xóa công việc"
        message="Dữ liệu sẽ bị xóa vĩnh viễn."
        confirmText="Đồng ý xóa"
        cancelText="Hủy bỏ"
        variant="danger"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )

    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Xác nhận xóa công việc' })).toBeInTheDocument()
    expect(screen.getByText('Dữ liệu sẽ bị xóa vĩnh viễn.')).toBeInTheDocument()

    // Click confirm button
    const confirmBtn = screen.getByTestId('confirm-dialog-btn')
    expect(confirmBtn).toHaveTextContent('Đồng ý xóa')
    await user.click(confirmBtn)
    expect(onConfirm).toHaveBeenCalledTimes(1)

    // Click cancel button
    const cancelBtn = screen.getByTestId('confirm-dialog-cancel-btn')
    expect(cancelBtn).toHaveTextContent('Hủy bỏ')
    await user.click(cancelBtn)
    expect(onCancel).toHaveBeenCalledTimes(1)

    // Re-render closed
    rerender(
      <ConfirmDialog
        isOpen={false}
        title="Xác nhận xóa công việc"
        message="Dữ liệu sẽ bị xóa vĩnh viễn."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
  })

  it('2. ConfirmDialog: handles Escape key to cancel', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const user = userEvent.setup()

    render(
      <ConfirmDialog
        isOpen={true}
        title="Hủy bỏ thay đổi?"
        message="Các thay đổi chưa lưu sẽ mất."
        variant="warning"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )

    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('3. useConfirm via ConfirmProvider: resolves true on confirm and false on cancel', async () => {
    const user = userEvent.setup()

    render(
      <ConfirmProvider>
        <TestConfirmConsumer />
      </ConfirmProvider>
    )

    // Trigger confirmation
    const triggerBtn = screen.getByRole('button', { name: 'Kích hoạt xóa' })
    await user.click(triggerBtn)

    // Dialog opens
    expect(await screen.findByTestId('confirm-dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Xóa mục này?' })).toBeInTheDocument()
    expect(screen.getByText('Hành động này không thể hoàn tác.')).toBeInTheDocument()

    // Confirm action
    const confirmBtn = screen.getByTestId('confirm-dialog-btn')
    await user.click(confirmBtn)

    // Verify consumer received true
    await waitFor(() => {
      expect(screen.getByTestId('test-result')).toHaveTextContent('confirmed')
    })
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()

    // Trigger again and test cancel
    await user.click(triggerBtn)
    expect(await screen.findByTestId('confirm-dialog')).toBeInTheDocument()

    const cancelBtn = screen.getByTestId('confirm-dialog-cancel-btn')
    await user.click(cancelBtn)

    await waitFor(() => {
      expect(screen.getByTestId('test-result')).toHaveTextContent('cancelled')
    })
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
  })
})
