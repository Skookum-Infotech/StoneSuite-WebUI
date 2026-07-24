import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, Link } from 'react-router-dom'
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard'
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt'

// A stand-in for the add/edit pages: local form state, a guard over it, and a
// route change that the guard is expected to intercept.
function FormPage({ isReady = true }: { isReady?: boolean }) {
  const [name, setName] = useState('')
  const guard = useUnsavedChangesGuard({ name }, isReady)
  return (
    <div>
      <UnsavedChangesPrompt guard={guard} />
      <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <Link to="/elsewhere">Leave</Link>
      <button type="button" onClick={() => { guard.markClean(); }}>Mark saved</button>
    </div>
  )
}

function renderPage(isReady = true) {
  const router = createMemoryRouter(
    [
      { path: '/form', element: <FormPage isReady={isReady} /> },
      { path: '/elsewhere', element: <div>Elsewhere</div> },
    ],
    { initialEntries: ['/form'] },
  )
  render(<RouterProvider router={router} />)
}

describe('useUnsavedChangesGuard', () => {
  it('lets navigation through when nothing has been edited', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('link', { name: 'Leave' }))

    expect(screen.getByText('Elsewhere')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('blocks navigation and prompts once the form is dirty', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Name'), 'Acme')
    await user.click(screen.getByRole('link', { name: 'Leave' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument()
    expect(screen.queryByText('Elsewhere')).not.toBeInTheDocument()
  })

  it('keeps the user on the page when they choose to keep editing', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Name'), 'Acme')
    await user.click(screen.getByRole('link', { name: 'Leave' }))
    await user.click(screen.getByRole('button', { name: 'Keep editing' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Acme')
    expect(screen.queryByText('Elsewhere')).not.toBeInTheDocument()
  })

  it('completes the navigation when the user discards', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Name'), 'Acme')
    await user.click(screen.getByRole('link', { name: 'Leave' }))
    await user.click(screen.getByRole('button', { name: 'Discard changes' }))

    expect(screen.getByText('Elsewhere')).toBeInTheDocument()
  })

  it('stops blocking after markClean, so a post-save navigate is not intercepted', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Name'), 'Acme')
    await user.click(screen.getByRole('button', { name: 'Mark saved' }))
    await user.click(screen.getByRole('link', { name: 'Leave' }))

    expect(screen.getByText('Elsewhere')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not baseline until isReady, so a still-loading record cannot look dirty', async () => {
    const user = userEvent.setup()
    renderPage(false)

    await user.type(screen.getByLabelText('Name'), 'Acme')
    await user.click(screen.getByRole('link', { name: 'Leave' }))

    expect(screen.getByText('Elsewhere')).toBeInTheDocument()
  })
})
