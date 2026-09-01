import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AxiosError } from 'axios'

vi.mock('@/services/authService', () => ({
  authService: { login: vi.fn() },
}))

import { PasswordStep } from './PasswordStep'
import { authService } from '@/services/authService'
import type { AuthResponse } from '@/types/auth'

function renderStep(
  overrides: Partial<{
    email: string
    onSuccess: (response: AuthResponse) => void
    onBack: () => void
  }> = {},
) {
  const onSuccess = overrides.onSuccess ?? vi.fn()
  const onBack = overrides.onBack ?? vi.fn()
  render(
    <MemoryRouter>
      <PasswordStep email={overrides.email ?? 'jane@acme.com'} onSuccess={onSuccess} onBack={onBack} />
    </MemoryRouter>,
  )
  return { onSuccess, onBack }
}

const successResponse: AuthResponse = {
  success: true,
  token: 'tok-1',
  expiresAt: Date.now() + 60_000,
  user: { id: 'u1', email: 'jane@acme.com', fullName: 'Jane Doe', tenantId: 't1' },
}

describe('PasswordStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the resolved email as read-only context', () => {
    renderStep({ email: 'jane@acme.com' })
    expect(screen.getByText('jane@acme.com')).toBeInTheDocument()
  })

  it('validates a required password before calling login', async () => {
    const user = userEvent.setup()
    const { onSuccess } = renderStep()

    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Password is required')).toBeInTheDocument()
    expect(authService.login).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('calls onSuccess with the full response on a successful login', async () => {
    const user = userEvent.setup()
    vi.mocked(authService.login).mockResolvedValue(successResponse)
    const { onSuccess } = renderStep({ email: 'jane@acme.com' })

    await user.type(screen.getByLabelText('Password'), 'hunter2')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledWith(successResponse))
    expect(authService.login).toHaveBeenCalledWith({
      email: 'jane@acme.com',
      password: 'hunter2',
      rememberMe: false,
    })
  })

  it('shows the server message when login reports failure without a token', async () => {
    const user = userEvent.setup()
    vi.mocked(authService.login).mockResolvedValue({ success: false, message: 'Invalid email or password.' })
    const { onSuccess } = renderStep()

    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('shows a root-level error when the login call itself fails', async () => {
    const user = userEvent.setup()
    const err = new AxiosError('fail', undefined, undefined, undefined, {
      status: 500,
      data: { message: 'Something broke upstream.' },
    } as never)
    vi.mocked(authService.login).mockRejectedValue(err)
    const { onSuccess } = renderStep()

    await user.type(screen.getByLabelText('Password'), 'hunter2')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Something broke upstream.')).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('calls onBack when "Change" is clicked', async () => {
    const user = userEvent.setup()
    const { onBack } = renderStep()

    await user.click(screen.getByRole('button', { name: 'Use a different email' }))

    expect(onBack).toHaveBeenCalledOnce()
  })

  it('toggles the password field between masked and visible', async () => {
    const user = userEvent.setup()
    renderStep()

    const passwordInput = screen.getByLabelText('Password')
    expect(passwordInput).toHaveAttribute('type', 'password')

    const toggle = screen.getByRole('button', { name: 'Show password' })
    await user.click(toggle)

    expect(passwordInput).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(passwordInput).toHaveAttribute('type', 'password')
  })
})
