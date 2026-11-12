import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'

vi.mock('@/services/authService', () => ({
  authService: { takeoverSession: vi.fn() },
}))

import { TakeoverPrompt } from './TakeoverPrompt'
import { authService } from '@/services/authService'
import type { AuthResponse } from '@/types/auth'

const SESSION: AuthResponse = {
  success: true,
  token: 'tok',
  expiresAt: Date.now() + 60_000,
  user: { id: 'u1', email: 'jane@acme.com', fullName: 'Jane', tenantId: 't1' },
}

function renderPrompt() {
  const onSuccess = vi.fn()
  const onCancel = vi.fn()
  render(
    <TakeoverPrompt
      prompt={{ deviceLabel: 'Chrome on Windows', lastSeenAt: Date.now() - 5 * 60_000 }}
      onSuccess={onSuccess}
      onCancel={onCancel}
    />,
  )
  return { onSuccess, onCancel }
}

describe('TakeoverPrompt', () => {
  beforeEach(() => vi.clearAllMocks())

  it('names the other device and when it was last active', () => {
    renderPrompt()
    expect(screen.getByText(/Chrome on Windows, active 5 minutes ago/)).toBeInTheDocument()
  })

  it('ends the other session and signs in on Continue', async () => {
    const user = userEvent.setup()
    vi.mocked(authService.takeoverSession).mockResolvedValue(SESSION)
    const { onSuccess, onCancel } = renderPrompt()

    await user.click(screen.getByRole('button', { name: 'End the other session and continue here' }))

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledWith(SESSION))
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('keeps the other session on Cancel', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderPrompt()

    await user.click(screen.getByRole('button', { name: 'Cancel and keep the other session' }))

    expect(onCancel).toHaveBeenCalled()
    expect(authService.takeoverSession).not.toHaveBeenCalled()
  })

  it('asks to sign in again once the prompt has expired', async () => {
    const user = userEvent.setup()
    vi.mocked(authService.takeoverSession).mockRejectedValue(
      new AxiosError('gone', undefined, undefined, undefined, {
        status: 410,
        data: { success: false, code: 'takeover_expired', message: 'This sign-in has expired. Please sign in again.' },
      } as never),
    )
    const { onCancel } = renderPrompt()

    await user.click(screen.getByRole('button', { name: 'End the other session and continue here' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('This sign-in has expired')
    expect(screen.queryByRole('button', { name: 'End the other session and continue here' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign in again' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
