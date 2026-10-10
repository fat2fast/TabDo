import React, { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AutoResizeTextarea } from '../auto-resize-textarea'

function TestHarness({ initialValue = '' }: { initialValue?: string }) {
  const [val, setVal] = useState(initialValue)
  return (
    <div>
      <label htmlFor="test-title">Tiêu đề *</label>
      <AutoResizeTextarea
        id="test-title"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Nhập tiêu đề..."
      />
    </div>
  )
}

describe('AutoResizeTextarea', () => {
  it('renders with initial long value and enables editing', async () => {
    const user = userEvent.setup()
    const longTitle =
      'If you already have a coding agent open in a folder, paste this and skip the rest of the page. It installs the skills, makes the video, and opens the preview — you are done.'

    render(<TestHarness initialValue={longTitle} />)

    const textarea = screen.getByLabelText(/tiêu đề/i) as HTMLTextAreaElement
    expect(textarea).toBeInTheDocument()
    expect(textarea.tagName.toLowerCase()).toBe('textarea')
    expect(textarea.value).toBe(longTitle)

    await user.type(textarea, ' Extra details.')
    expect(textarea.value).toContain('Extra details.')
  })

  it('prevents default on Enter key to avoid accidental newlines in title', async () => {
    const user = userEvent.setup()
    render(<TestHarness initialValue="Initial" />)

    const textarea = screen.getByLabelText(/tiêu đề/i) as HTMLTextAreaElement
    await user.type(textarea, '{Enter}')

    // Should not insert newline
    expect(textarea.value).toBe('Initial')
  })
})
