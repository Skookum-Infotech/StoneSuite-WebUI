import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'

vi.mock('@/services/samlAuthService', () => ({
  samlAuthService: { exchange: vi.fn() },
}))

import SsoCallbackPage from './SsoCallbackPage'
import { samlAuthService } from '@/services/samlAuthService'
import { useAuthStore } from '@/store/useAuthStore'
import { SAML_PENDING_PROVIDER_KEY, SAML_ACTIVE_PROVIDER_KEY } from '@/lib/samlSession'

function renderAt(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createMemoryRouter(
    [
      { path: '/dashboard', element: <div>Dashboard</div> },
      { path: '/crm/records/42', element: <div>Deep link target</div> },
      { path: '/auth/sso/callback', element: <SsoCallbackPage /> },
      { path: '/auth/login', element: <div>Sign in</div> },
    ],
    { initialEntries: [initialPath] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('SsoCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    useAuthStore.getState().logout()
  })

  it('exchanges the code, promotes the pending provider, and navigates to return_to', async () => {
    sessionStorage.setItem(SAML_PENDING_PROVIDER_KEY, 'entra')
    vi.mocked(samlAuthService.exchange).mockResolvedValue({
      success: true,
      token: 'jwt',
      expiresAt: Date.now() + 60_000,
      user: { id: 'u1', email: 'a@b.com', fullName: 'A B' },
    })

    renderAt('/auth/sso/callback?code=abc123&return_to=%2Fcrm%2Frecords%2F42')

    expect(await screen.findByText('Deep link target')).toBeInTheDocument()
    expect(samlAuthService.exchange).toHaveBeenCalledWith('abc123')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(sessionStorage.getItem(SAML_ACTIVE_PROVIDER_KEY)).toBe('entra')
    expect(sessionStorage.getItem(SAML_PENDING_PROVIDER_KEY)).toBeNull()
  })

  it('falls back to /dashboard when return_to is absent', async () => {
    vi.mocked(samlAuthService.exchange).mockResolvedValue({
      success: true,
      token: 'jwt',
      expiresAt: Date.now() + 60_000,
      user: { id: 'u1', email: 'a@b.com', fullName: 'A B' },
    })

    renderAt('/auth/sso/callback?code=abc123')

    expect(await screen.findByText('Dashboard')).toBeInTheDocument()
  })

  it('shows an expired-link error with a way back to login when the code is invalid', async () => {
    const err = new AxiosError('fail', undefined, undefined, undefined, {
      status: 400,
      data: { message: 'Invalid or expired sign-in code.' },
    } as never)
    vi.mocked(samlAuthService.exchange).mockRejectedValue(err)

    renderAt('/auth/sso/callback?code=stale-code')

    expect(await screen.findByText('Sign-in link expired')).toBeInTheDocument()
    expect(screen.getByText('Invalid or expired sign-in code.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toBeInTheDocument()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('shows an error immediately when no code is present, without calling exchange', async () => {
    renderAt('/auth/sso/callback')

    expect(await screen.findByText('Sign-in link expired')).toBeInTheDocument()
    expect(samlAuthService.exchange).not.toHaveBeenCalled()
  })
})
