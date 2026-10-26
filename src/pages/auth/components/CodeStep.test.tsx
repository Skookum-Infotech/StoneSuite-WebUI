import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'

vi.mock('@/services/authService', () => ({
  authService: { verifyMfa: vi.fn(), resendMfa: vi.fn() },
}))

import { CodeStep } from './CodeStep'
import { authService } from '@/services/authService'
import type { AuthResponse, MfaChallenge } from '@/types/auth'

const CHALLENGE: MfaChallenge = {
  success: true,
  challengeToken: 'tok-1',
  maskedEmail: 'j•••@acme.com',
  codeLength: 6,
  expiresInSeconds: 600,
  resendAfterSeconds: 0,
}

const SESSION: AuthResponse = {
  success: true,
  token: 'tok-session',
  expiresAt: Date.now() + 60_000,
  user: { id: 'u1', email: 'jane@acme.com', fullName: 'Jane Doe', tenantId: 't1' },
}

function apiError(status: number, data: Record<string, unknown>) {
  return new AxiosError('fail', undefined, undefined, undefined, { status, data } as never)
}

function renderStep(challenge: Partial<MfaChallenge> = {}) {
  const onSuccess = vi.fn()
  const onBack = vi.fn()
  render(<CodeStep challenge={{ ...CHALLENGE, ...challenge }} onSuccess={onSuccess} onBack={onBack} />)
  return { onSuccess, onBack }
}

const codeBox = () => screen.getByLabelText('Sign-in code')
const verifyButton = () => screen.getByRole('button', { name: 'Verify code' })

describe('CodeStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('says where the code went and how long it works', () => {
    renderStep()
    expect(screen.getByText('Code sent to j•••@acme.com')).toBeInTheDocument()
    expect(screen.getByText('The code works for 10 minutes.')).toBeInTheDocument()
  })

  it('lets only digits into the box', async () => {
    const user = userEvent.setup()
    renderStep()

    await user.type(codeBox(), '12ab3 -4x56')

    expect(codeBox()).toHaveValue('123456')
  })

  it('asks for the full code before calling the server', async () => {
    const user = userEvent.setup()
    const { onSuccess } = renderStep()

    await user.type(codeBox(), '123')
    await user.click(verifyButton())

    expect(await screen.findByText('Enter the 6-digit code from your email')).toBeInTheDocument()
    expect(authService.verifyMfa).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('hands the session to onSuccess once the code is accepted', async () => {
    const user = userEvent.setup()
    vi.mocked(authService.verifyMfa).mockResolvedValue(SESSION)
    const { onSuccess } = renderStep()

    await user.type(codeBox(), '042917')
    await user.click(verifyButton())

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledWith(SESSION))
    expect(authService.verifyMfa).toHaveBeenCalledWith('tok-1', '042917')
  })

  it('shows the tries left on a wrong code and clears the box', async () => {
    const user = userEvent.setup()
    vi.mocked(authService.verifyMfa).mockRejectedValue(
      apiError(400, { code: 'mfa_code_invalid', message: "That code isn't right.", attemptsLeft: 4 }),
    )
    const { onSuccess } = renderStep()

    await user.type(codeBox(), '111111')
    await user.click(verifyButton())

    expect(await screen.findByText("That code isn't right. 4 attempts left.")).toBeInTheDocument()
    expect(codeBox()).toHaveValue('')
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it.each([
    ['expired', 'mfa_challenge_expired', 'This code has expired. Sign in again to get a new one.'],
    ['locked out', 'mfa_challenge_locked', 'Too many incorrect codes. Sign in again to get a new one.'],
  ])('sends the person back to sign in when the challenge is %s', async (_name, code, message) => {
    const user = userEvent.setup()
    vi.mocked(authService.verifyMfa).mockRejectedValue(apiError(410, { code, message }))
    const { onBack } = renderStep()

    await user.type(codeBox(), '111111')
    await user.click(verifyButton())

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verify code' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign in again' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('shows the server message when the response carries no session', async () => {
    const user = userEvent.setup()
    vi.mocked(authService.verifyMfa).mockResolvedValue({ success: false, message: 'Login failed.' })
    const { onSuccess } = renderStep()

    await user.type(codeBox(), '042917')
    await user.click(verifyButton())

    expect(await screen.findByText('Login failed.')).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('goes back to the password step from "Back"', async () => {
    const user = userEvent.setup()
    const { onBack } = renderStep()

    await user.click(screen.getByRole('button', { name: 'Back to password' }))

    expect(onBack).toHaveBeenCalledOnce()
  })

  describe('resending', () => {
    it('keeps Resend greyed out while the server cooldown runs', () => {
      renderStep({ resendAfterSeconds: 60 })
      expect(screen.getByRole('button', { name: 'Resend code in 60 seconds' })).toBeDisabled()
    })

    it('sends a new code, says so, and starts the cooldown again', async () => {
      const user = userEvent.setup()
      vi.mocked(authService.resendMfa).mockResolvedValue({
        success: true, maskedEmail: 'j•••@acme.com', codeLength: 6, expiresInSeconds: 600, resendAfterSeconds: 60,
      })
      renderStep()

      await user.type(codeBox(), '123')
      await user.click(screen.getByRole('button', { name: 'Resend code' }))

      expect(await screen.findByText('A new code is on its way to j•••@acme.com.')).toBeInTheDocument()
      expect(authService.resendMfa).toHaveBeenCalledWith('tok-1')
      expect(codeBox()).toHaveValue('')
      expect(screen.getByRole('button', { name: 'Resend code in 60 seconds' })).toBeDisabled()
    })

    it('restarts the countdown from the wait the server reports when a click comes too soon', async () => {
      const user = userEvent.setup()
      vi.mocked(authService.resendMfa).mockRejectedValue(
        apiError(429, { code: 'mfa_resend_too_soon', message: 'Please wait before asking for another code.', retryAfterSeconds: 25 }),
      )
      renderStep()

      await user.click(screen.getByRole('button', { name: 'Resend code' }))

      expect(await screen.findByText('Please wait before asking for another code.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Resend code in 25 seconds' })).toBeDisabled()
    })

    it('falls back to sign-in when the challenge died before the resend', async () => {
      const user = userEvent.setup()
      vi.mocked(authService.resendMfa).mockRejectedValue(
        apiError(410, { code: 'mfa_challenge_expired', message: 'This code has expired. Sign in again to get a new one.' }),
      )
      renderStep()

      await user.click(screen.getByRole('button', { name: 'Resend code' }))

      expect(await screen.findByRole('button', { name: 'Sign in again' })).toBeInTheDocument()
    })
  })
})
