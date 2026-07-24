import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import AuthLayout from './AuthLayout'
import { useAuthStore } from '@/store/useAuthStore'
import type { UserProfile } from '@/types/auth'

// Guards the history-hygiene rule: a signed-in user walking back through browser
// history must never land on the sign-in form.

const TEST_USER = { id: 'u1', email: 'a@b.com', fullName: 'A B' } as UserProfile

function renderAt(initialPath: string) {
  const router = createMemoryRouter(
    [
      { path: '/dashboard', element: <div>Dashboard</div> },
      {
        path: '/auth',
        element: <AuthLayout />,
        children: [
          { path: 'login', element: <div>Sign in</div> },
          { path: 'reset-password', element: <div>Reset password</div> },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  )
  render(<RouterProvider router={router} />)
}

describe('AuthLayout', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.getState().logout()
  })

  it('renders the sign-in page when the user is not authenticated', () => {
    renderAt('/auth/login')
    expect(screen.getByText('Sign in')).toBeInTheDocument()
  })

  it('redirects an authenticated user away from the sign-in page', () => {
    useAuthStore.getState().setAuth(TEST_USER, 'token', Date.now() + 60_000)
    renderAt('/auth/login')
    expect(screen.queryByText('Sign in')).not.toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('still allows an authenticated user to open a reset-password link', () => {
    useAuthStore.getState().setAuth(TEST_USER, 'token', Date.now() + 60_000)
    renderAt('/auth/reset-password')
    expect(screen.getByText('Reset password')).toBeInTheDocument()
  })
})
