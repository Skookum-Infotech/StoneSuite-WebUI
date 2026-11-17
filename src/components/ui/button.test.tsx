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

  // The approved button system (DESIGN.md "Buttons"): each kind and size maps to
  // one fixed set of classes, so a button looks the same on every page.
  it.each([
    ['default', 'bg-brand', 'font-semibold'],
    ['outline', 'bg-white', 'font-medium'],
    ['secondary', 'bg-white', 'font-medium'],
    ['ghost', 'text-ink', 'font-medium'],
    ['destructive', 'bg-danger-solid', 'font-semibold'],
  ] as const)('styles the %s kind', (variant, fill, weight) => {
    render(<Button variant={variant}>Go</Button>)
    const button = screen.getByRole('button', { name: 'Go' })
    expect(button).toHaveClass('text-button', fill, weight)
  })

  it.each([
    ['sm', 'h-6.5', 'text-button'],
    ['default', 'h-7.5', 'text-button'],
    ['lg', 'h-9.5', 'text-body'],
  ] as const)('sizes the %s button', (size, height, text) => {
    render(<Button size={size}>Go</Button>)
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass(height, text)
  })

  it('keeps every button tap-sized on touch screens', () => {
    render(<Button size="sm">Go</Button>)
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass('pointer-coarse:min-h-10')
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
