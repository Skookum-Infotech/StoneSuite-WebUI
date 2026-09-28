import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PasswordInput } from './PasswordInput'

describe('PasswordInput', () => {
  it('starts masked', () => {
    render(<PasswordInput aria-label="Password" />)
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
  })

  it('reveals the typed value when the eye button is clicked, and hides it again', async () => {
    const user = userEvent.setup()
    render(<PasswordInput aria-label="Password" />)
    const input = screen.getByLabelText('Password')
    await user.type(input, 'Abcdef1!')

    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveValue('Abcdef1!')

    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveValue('Abcdef1!')
  })

  it('names the toggle after the field so two fields on one page stay distinguishable', () => {
    render(
      <>
        <PasswordInput aria-label="New password" toggleLabel="new password" />
        <PasswordInput aria-label="Confirm password" toggleLabel="confirmation password" />
      </>,
    )
    expect(screen.getByRole('button', { name: 'Show new password' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show confirmation password' })).toBeInTheDocument()
  })

  it('keeps the toggle out of form submission and reachable by keyboard', async () => {
    const user = userEvent.setup()
    render(<PasswordInput aria-label="Password" />)
    const toggle = screen.getByRole('button', { name: 'Show password' })
    expect(toggle).toHaveAttribute('type', 'button')

    toggle.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text')
  })

  it('forwards a ref to the underlying input (needed by react-hook-form register)', () => {
    let el: HTMLInputElement | null = null
    render(<PasswordInput aria-label="Password" ref={(node) => { el = node }} />)
    expect(el).toBeInstanceOf(HTMLInputElement)
  })
})
