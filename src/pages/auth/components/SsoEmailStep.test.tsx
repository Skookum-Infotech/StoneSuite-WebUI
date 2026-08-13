import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'

vi.mock('@/services/samlAuthService', () => ({
  samlAuthService: { discover: vi.fn() },
}))

import { SsoEmailStep } from './SsoEmailStep'
import { samlAuthService } from '@/services/samlAuthService'
import type { SAMLProvider } from '@/types/tenant'

function renderStep(
  overrides: Partial<{
    provider: SAMLProvider
    defaultEmail: string
    onResolved: (tenantId: string, provider: SAMLProvider) => void
    onBack: () => void
  }> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const onResolved = overrides.onResolved ?? vi.fn()
  const onBack = overrides.onBack ?? vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <SsoEmailStep
        provider={overrides.provider ?? 'entra'}
        defaultEmail={overrides.defaultEmail ?? ''}
        onResolved={onResolved}
        onBack={onBack}
      />
    </QueryClientProvider>,
  )
  return { onResolved, onBack }
}

describe('SsoEmailStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prefills the email field from defaultEmail', () => {
    renderStep({ defaultEmail: 'jane@acme.com' })
    expect(screen.getByLabelText('Work email')).toHaveValue('jane@acme.com')
  })

  it('validates a required email before calling discover', async () => {
    const user = userEvent.setup()
    const { onResolved } = renderStep({ defaultEmail: '' })

    await user.click(screen.getByRole('button', { name: 'Continue signing in with Microsoft Entra ID' }))

    expect(await screen.findByText('Work email is required')).toBeInTheDocument()
    expect(samlAuthService.discover).not.toHaveBeenCalled()
    expect(onResolved).not.toHaveBeenCalled()
  })

  it('validates email format before calling discover', async () => {
    const user = userEvent.setup()
    const { onResolved } = renderStep({ defaultEmail: '' })

    await user.type(screen.getByLabelText('Work email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Continue signing in with Microsoft Entra ID' }))

    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument()
    expect(samlAuthService.discover).not.toHaveBeenCalled()
    expect(onResolved).not.toHaveBeenCalled()
  })

  it('auto-resolves when the discovered provider matches the one clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(samlAuthService.discover).mockResolvedValue({
      found: true,
      provider: 'entra',
      tenantId: 'tenant-1',
    })
    const { onResolved } = renderStep({ provider: 'entra', defaultEmail: 'jane@acme.com' })

    await user.click(screen.getByRole('button', { name: 'Continue signing in with Microsoft Entra ID' }))

    await vi.waitFor(() => expect(onResolved).toHaveBeenCalledWith('tenant-1', 'entra'))
    expect(samlAuthService.discover).toHaveBeenCalledWith('jane@acme.com')
  })

  it('shows a mismatch banner and only resolves with the discovered provider after clicking Continue', async () => {
    const user = userEvent.setup()
    vi.mocked(samlAuthService.discover).mockResolvedValue({
      found: true,
      provider: 'cognito',
      tenantId: 'tenant-2',
    })
    const { onResolved } = renderStep({ provider: 'entra', defaultEmail: 'jane@acme.com' })

    await user.click(screen.getByRole('button', { name: 'Continue signing in with Microsoft Entra ID' }))

    expect(
      await screen.findByText(/That email signs in with/, { exact: false }),
    ).toBeInTheDocument()
    expect(screen.getByText('Amazon Cognito')).toBeInTheDocument()
    expect(onResolved).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Continue signing in with Amazon Cognito' }))

    expect(onResolved).toHaveBeenCalledWith('tenant-2', 'cognito')
  })

  it('shows a field-level error and does not resolve when no SSO connection is found', async () => {
    const user = userEvent.setup()
    vi.mocked(samlAuthService.discover).mockResolvedValue({ found: false })
    const { onResolved } = renderStep({ provider: 'entra', defaultEmail: 'jane@acme.com' })

    await user.click(screen.getByRole('button', { name: 'Continue signing in with Microsoft Entra ID' }))

    expect(
      await screen.findByText('No SSO connection found for that email address.'),
    ).toBeInTheDocument()
    expect(onResolved).not.toHaveBeenCalled()
  })

  it('shows a root-level error when the discover call itself fails', async () => {
    const user = userEvent.setup()
    const err = new AxiosError('fail', undefined, undefined, undefined, {
      status: 500,
      data: { message: 'Something broke upstream.' },
    } as never)
    vi.mocked(samlAuthService.discover).mockRejectedValue(err)
    const { onResolved } = renderStep({ provider: 'entra', defaultEmail: 'jane@acme.com' })

    await user.click(screen.getByRole('button', { name: 'Continue signing in with Microsoft Entra ID' }))

    expect(await screen.findByText('Something broke upstream.')).toBeInTheDocument()
    expect(onResolved).not.toHaveBeenCalled()
  })

  it('calls onBack when "Back to sign-in options" is clicked', async () => {
    const user = userEvent.setup()
    const { onBack } = renderStep()

    await user.click(screen.getByRole('button', { name: 'Back to sign-in options' }))

    expect(onBack).toHaveBeenCalledOnce()
  })
})
