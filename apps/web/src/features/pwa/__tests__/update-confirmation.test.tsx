import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { PwaUpdateNotice } from '../pwa-update-notice'

const mock = vi.hoisted(() => ({ state: 'waiting', confirm: vi.fn(), activate: vi.fn(), reload: vi.fn() }))
vi.mock('../pwa-update-context', () => ({ usePwaUpdate: () => ({ state: mock.state, error: false }) }))
vi.mock('../../../components/ui/confirm-dialog', () => ({ useConfirm: () => mock.confirm }))
vi.mock('../use-pwa-registration', () => ({ getUpdateState: () => mock.state, activateUpdate: mock.activate, reloadUpdatedWindow: mock.reload }))

it('uses the current version state after a confirmation resolves', async () => {
  let resolve!: (accepted: boolean) => void
  mock.confirm.mockReturnValue(new Promise<boolean>(done => { resolve = done }))
  render(<PwaUpdateNotice />)
  fireEvent.click(screen.getByRole('button', { name: 'Cập nhật và tải lại' }))
  mock.state = 'controller-changed-needs-reload'
  await act(async () => { resolve(true) })
  expect(mock.reload).toHaveBeenCalledTimes(1)
  expect(mock.activate).not.toHaveBeenCalled()
})
