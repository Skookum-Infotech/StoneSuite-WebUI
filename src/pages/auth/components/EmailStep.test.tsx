import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'

vi.mock('@/services/authService', () => ({
  authService: { identify: vi.fn() },
}))

import { EmailStep } from './EmailStep'
import { authService } from '@/services/authService'
import type { IdentifyResult } from '@/types/auth'

function renderStep(
  overrides: Partial<{
    defaultEmail: string
    onIdentified: (email: string, result: IdentifyResult) => void
  }> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const onIdentified = overrides.onIdentified ?? vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <EmailStep defaultEmail={overrides.defaultEmail ?? ''} onIdentified={onIdentified} />
    </QueryClientProvider>,
  )
  return { onIdentified }
}

describe('EmailStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prefills the email field from defaultEmail', () => {
    renderStep({ defaultEmail: 'jane@acme.com' })
    expect(screen.getByLabelText('Email')).toHaveValue('jane@acme.com')
  })

  it('validates a required email before calling identify', async () => {
    const user = userEvent.setup()
    const { onIdentified } = renderStep()

    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Email is required')).toBeInTheDocument()
    expect(authService.identify).not.toHaveBeenCalled()
    expect(onIdentified).not.toHaveBeenCalled()
  })

  it('validates email format before calling identify', async () => {
    const user = userEvent.setup()
    const { onIdentified } = renderStep()

    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument()
    expect(authService.identify).not.toHaveBeenCalled()
    expect(onIdentified).not.toHaveBeenCalled()
  })

  it('reports a password result once identify resolves', async () => {
    const user = userEvent.setup()
    vi.mocked(authService.identify).mockResolvedValue({ method: 'password' })
    const { onIdentified } = renderStep({ defaultEmail: 'jane@acme.com' })

    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await vi.waitFor(() =>
      expect(onIdentified).toHaveBeenCalledWith('jane@acme.com', { method: 'password' }),
    )
  })

  it('reports an sso result once identify resolves', async () => {
    const user = userEvent.setup()
    vi.mocked(authService.identify).mockResolvedValue({
      method: 'sso',
      provider: 'entra',
      tenantId: 'tenant-1',
    })
    const { onIdentified } = renderStep({ defaultEmail: 'jane@acme.com' })

    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await vi.waitFor(() =>
      expect(onIdentified).toHaveBeenCalledWith('jane@acme.com', {
        method: 'sso',
        provider: 'entra',
        tenantId: 'tenant-1',
      }),
    )
  })

  it('shows a root-level error when the identify call itself fails', async () => {
    const user = userEvent.setup()
    const err = new AxiosError('fail', undefined, undefined, undefined, {
      status: 500,
      data: { message: 'Something broke upstream.' },
    } as never)
    vi.mocked(authService.identify).mockRejectedValue(err)
    const { onIdentified } = renderStep({ defaultEmail: 'jane@acme.com' })

    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Something broke upstream.')).toBeInTheDocument()
    expect(onIdentified).not.toHaveBeenCalled()
  })
})
