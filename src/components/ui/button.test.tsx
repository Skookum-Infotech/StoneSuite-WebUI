import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './button'

// Smoke test that proves the harness end-to-end: jsdom render + RTL queries +
// user-event interaction + jest-dom matchers all wired correctly.
describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('fires onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Click' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Nope
      </Button>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Nope' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
