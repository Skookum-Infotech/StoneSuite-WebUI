import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'

vi.mock('@/services/authService', () => ({
  authService: {
    getMfaStatus: vi.fn(),
    startEnableMfa: vi.fn(),
    confirmEnableMfa: vi.fn(),
    disableMfa: vi.fn(),
  },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

import { TwoStepVerificationCard } from './TwoStepVerificationCard'
import { authService } from '@/services/authService'
import { toast } from 'sonner'
import type { MfaCodeSent, MfaStatus } from '@/types/auth'

const OFF: MfaStatus = { success: true, enabled: false, available: true, maskedEmail: 'a•••@example.com' }
const ON: MfaStatus = { ...OFF, enabled: true }
const SENT: MfaCodeSent = {
  success: true, maskedEmail: 'a•••@example.com', codeLength: 6, expiresInSeconds: 600, resendAfterSeconds: 60,
}

function apiError(status: number, data: Record<string, unknown>) {
  return new AxiosError('fail', undefined, undefined, undefined, { status, data } as never)
}

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <TwoStepVerificationCard />
    </QueryClientProvider>,
  )
}

const turnOnButton = () => screen.findByRole('button', { name: 'Turn on two-step verification' })
const dialog = () => screen.getByRole('dialog')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TwoStepVerificationCard — turning it on', () => {
  beforeEach(() => {
    vi.mocked(authService.getMfaStatus).mockResolvedValue(OFF)
    vi.mocked(authService.startEnableMfa).mockResolvedValue(SENT)
  })

  it('shows it off, with where a code would go', async () => {
    renderCard()

    expect(await screen.findByText('Off')).toBeInTheDocument()
    expect(screen.getByText(/a•••@example\.com/)).toBeInTheDocument()
  })

  it('emails a code and opens the confirm dialog when "Turn on" is clicked', async () => {
    const user = userEvent.setup()
    renderCard()

    await user.click(await turnOnButton())

    expect(authService.startEnableMfa).toHaveBeenCalledOnce()
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(within(dialog()).getByText('We emailed a code to a•••@example.com.')).toBeInTheDocument()
    expect(authService.confirmEnableMfa).not.toHaveBeenCalled()
  })

  it('turns it on with the emailed code, says so, and shows it on', async () => {
    const user = userEvent.setup()
    vi.mocked(authService.confirmEnableMfa).mockResolvedValue({ success: true, enabled: true })
    vi.mocked(authService.getMfaStatus).mockResolvedValueOnce(OFF).mockResolvedValue(ON)
    renderCard()

    await user.click(await turnOnButton())
    await user.type(await screen.findByLabelText('Code from your email'), '042917')
    await user.click(screen.getByRole('button', { name: 'Confirm code and turn on two-step verification' }))

    await vi.waitFor(() => expect(authService.confirmEnableMfa).toHaveBeenCalledWith('042917'))
    expect(toast.success).toHaveBeenCalledWith('Two-step verification is on')
    expect(await screen.findByText('On')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps it off and shows the tries left on a wrong code', async () => {
    const user = userEvent.setup()
    vi.mocked(authService.confirmEnableMfa).mockRejectedValue(
      apiError(400, { code: 'mfa_code_invalid', message: "That code isn't right.", attemptsLeft: 4 }),
    )
    renderCard()

    await user.click(await turnOnButton())
    await user.type(await screen.findByLabelText('Code from your email'), '111111')
    await user.click(screen.getByRole('button', { name: 'Confirm code and turn on two-step verification' }))

    expect(await screen.findByText("That code isn't right. 4 attempts left.")).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('lets a new code be requested right away once the old one is dead', async () => {
    const user = userEvent.setup()
    vi.mocked(authService.confirmEnableMfa).mockRejectedValue(
      apiError(410, { code: 'mfa_challenge_locked', message: 'Too many incorrect codes. Send a new code to try again.' }),
    )
    renderCard()

    await user.click(await turnOnButton())
    expect(within(dialog()).getByRole('button', { name: 'Resend code in 60 seconds' })).toBeDisabled()
    await user.type(await screen.findByLabelText('Code from your email'), '111111')
    await user.click(screen.getByRole('button', { name: 'Confirm code and turn on two-step verification' }))

    expect(await screen.findByText('Too many incorrect codes. Send a new code to try again.')).toBeInTheDocument()
    expect(within(dialog()).getByRole('button', { name: 'Resend code' })).toBeEnabled()
  })

  it('sends a fresh code from the dialog\'s Resend button', async () => {
    const user = userEvent.setup()
    vi.mocked(authService.startEnableMfa).mockResolvedValue({ ...SENT, resendAfterSeconds: 0 })
    renderCard()

    await user.click(await turnOnButton())
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Resend code' }))

    expect(await screen.findByText('A new code is on its way to a•••@example.com.')).toBeInTheDocument()
    expect(authService.startEnableMfa).toHaveBeenCalledTimes(2)
  })

  it('opens the dialog on a code sent a moment ago instead of showing an error', async () => {
    const user = userEvent.setup()
    vi.mocked(authService.startEnableMfa).mockRejectedValue(
      apiError(429, { code: 'mfa_resend_too_soon', message: 'Please wait before asking for another code.', retryAfterSeconds: 40 }),
    )
    renderCard()

    await user.click(await turnOnButton())

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(within(dialog()).getByText(/A code was just sent to you/)).toBeInTheDocument()
    expect(within(dialog()).getByRole('button', { name: 'Resend code in 40 seconds' })).toBeDisabled()
  })

  it('shows why when the code could not be sent', async () => {
    const user = userEvent.setup()
    vi.mocked(authService.startEnableMfa).mockRejectedValue(
      apiError(503, { code: 'mfa_send_failed', message: "We couldn't send your code right now. Please try again in a moment." }),
    )
    renderCard()

    await user.click(await turnOnButton())

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't send your code right now.")
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('TwoStepVerificationCard — turning it off', () => {
  beforeEach(() => {
    vi.mocked(authService.getMfaStatus).mockResolvedValue(ON)
  })

  const openDisableDialog = async (user: ReturnType<typeof userEvent.setup>) => {
    renderCard()
    expect(await screen.findByText('On')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Turn off two-step verification' }))
    return await screen.findByRole('dialog')
  }

  it('asks for the password before turning it off', async () => {
    const user = userEvent.setup()
    await openDisableDialog(user)

    await user.click(screen.getByRole('button', { name: 'Confirm password and turn off two-step verification' }))

    expect(await screen.findByText('Enter your current password')).toBeInTheDocument()
    expect(authService.disableMfa).not.toHaveBeenCalled()
  })

  it('shows a wrong password under the field and stays on', async () => {
    const user = userEvent.setup()
    vi.mocked(authService.disableMfa).mockRejectedValue(
      apiError(400, { code: 'invalid_password', message: 'Current password is incorrect.' }),
    )
    await openDisableDialog(user)

    await user.type(screen.getByLabelText('Current password'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Confirm password and turn off two-step verification' }))

    expect(await screen.findByText('Current password is incorrect.')).toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('turns it off with the right password, says so, and shows it off', async () => {
    const user = userEvent.setup()
    vi.mocked(authService.disableMfa).mockResolvedValue({ success: true, enabled: false })
    vi.mocked(authService.getMfaStatus).mockResolvedValueOnce(ON).mockResolvedValue(OFF)
    await openDisableDialog(user)

    await user.type(screen.getByLabelText('Current password'), 'hunter2')
    await user.click(screen.getByRole('button', { name: 'Confirm password and turn off two-step verification' }))

    await vi.waitFor(() => expect(authService.disableMfa).toHaveBeenCalledWith('hunter2'))
    expect(toast.success).toHaveBeenCalledWith('Two-step verification is off')
    expect(await screen.findByText('Off')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('leaves it on when the dialog is cancelled', async () => {
    const user = userEvent.setup()
    await openDisableDialog(user)

    await user.click(screen.getByRole('button', { name: 'Keep two-step verification on' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(authService.disableMfa).not.toHaveBeenCalled()
  })
})

describe('TwoStepVerificationCard — other states', () => {
  it('offers nothing to a single-sign-on account', async () => {
    vi.mocked(authService.getMfaStatus).mockResolvedValue({ ...OFF, available: false })
    renderCard()

    expect(await screen.findByText(/single sign-on/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /two-step verification/ })).not.toBeInTheDocument()
  })

  it('says so, and can retry, when the setting will not load', async () => {
    const user = userEvent.setup()
    vi.mocked(authService.getMfaStatus).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(OFF)
    renderCard()

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load your two-step verification setting.")
    await user.click(screen.getByRole('button', { name: 'Try loading two-step verification again' }))

    expect(await screen.findByText('Off')).toBeInTheDocument()
  })
})
