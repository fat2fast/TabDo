import React, { useState } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { UserScopedQueryProvider } from '../user-scoped-query-provider'

let identity = { user: { id: 'a' }, identityGeneration: 1 }
let finishMutation: (() => void) | undefined
vi.mock('../auth-provider', () => ({ useAuth: () => identity }))

function Contents() {
  const client = useQueryClient()
  const [draft, setDraft] = useState('')
  const mutation = useMutation({
    mutationFn: () => new Promise<void>(resolve => { finishMutation = resolve }),
    onSuccess: () => client.setQueryData(['private'], 'late A'),
  })
  return <>
    <input aria-label="draft" value={draft} onChange={event => setDraft(event.target.value)} />
    <button onClick={() => client.setQueryData(['private'], 'A data')}>cache</button>
    <button onClick={() => mutation.mutate()}>write</button>
    <span>{String(client.getQueryData(['private']) ?? 'empty')}</span>
  </>
}

describe('identity scoped query provider', () => {
  it('remounts drafts and replaces cache across identity transitions', async () => {
    identity = { user: { id: 'a' }, identityGeneration: 1 }
    const view = render(<UserScopedQueryProvider><Contents /></UserScopedQueryProvider>)
    fireEvent.change(screen.getByLabelText('draft'), { target: { value: 'private draft' } })
    fireEvent.click(screen.getByText('cache'))
    identity = { user: { id: 'b' }, identityGeneration: 2 }
    view.rerender(<UserScopedQueryProvider><Contents /></UserScopedQueryProvider>)
    await waitFor(() => expect(screen.getByText('empty')).toBeInTheDocument())
    expect(screen.getByLabelText('draft')).toHaveValue('')
  })

  it('keeps a late mutation completion on the old client', async () => {
    identity = { user: { id: 'a' }, identityGeneration: 1 }
    const view = render(<UserScopedQueryProvider><Contents /></UserScopedQueryProvider>)
    fireEvent.click(screen.getByText('write'))
    await waitFor(() => expect(finishMutation).toBeDefined())
    identity = { user: { id: 'b' }, identityGeneration: 2 }
    view.rerender(<UserScopedQueryProvider><Contents /></UserScopedQueryProvider>)
    finishMutation!()
    await waitFor(() => expect(screen.getByText('empty')).toBeInTheDocument())
    expect(screen.queryByText('late A')).not.toBeInTheDocument()
    finishMutation = undefined
  })
})
