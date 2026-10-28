import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { InstallPrompt } from '../install-prompt'

vi.mock('../../auth/auth-provider', () => ({ useAuth: () => ({ user: { id: 'a' }, profile: { id: 'a', isActive: true }, isAuthLoading: false, isProfileLoading: false }) }))

it('prompts once and hides the banner after acceptance', async () => {
  render(<InstallPrompt />)
  const event = new Event('beforeinstallprompt', { cancelable: true }) as any
  event.prompt = vi.fn().mockResolvedValue(undefined)
  event.userChoice = Promise.resolve({ outcome: 'accepted' })
  act(() => { window.dispatchEvent(event) })
  fireEvent.click(screen.getByRole('button', { name: 'Cài đặt' }))
  await waitFor(() => expect(event.prompt).toHaveBeenCalledTimes(1))
  expect(screen.queryByRole('button', { name: 'Cài đặt' })).not.toBeInTheDocument()
})
