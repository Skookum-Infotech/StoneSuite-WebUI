import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Loader2, AlertTriangle } from 'lucide-react'
import { samlAuthService } from '@/services/samlAuthService'
import { useAuthStore } from '@/store/useAuthStore'
import { apiErrorMessage } from '@/api/tenantClient'
import { SAML_PENDING_PROVIDER_KEY, SAML_ACTIVE_PROVIDER_KEY } from '@/lib/samlSession'
import { activeSessionPrompt } from '@/lib/singleSession'
import { TakeoverPrompt } from './components/TakeoverPrompt'
import type { AuthResponse } from '@/types/auth'

// Lands here after POST /api/auth/saml/exchange redirects the IdP round
// trip back to the app (via ACS -> this page). Trades the one-time code for
// a real session, exactly once per mount.
export default function SsoCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const setAuth = useAuthStore((state) => state.setAuth)
  const code = searchParams.get('code')
  const returnTo = searchParams.get('return_to')
  const started = useRef(false)

  // Shared by the exchange itself and by confirming the "already signed in
  // elsewhere" prompt, whose takeover answers with the same login response.
  const finishSignIn = (response: AuthResponse) => {
    if (!response.success || !response.user || !response.token || !response.expiresAt) {
      return
    }
    setAuth(response.user, response.token, response.expiresAt)

    const pendingProvider = sessionStorage.getItem(SAML_PENDING_PROVIDER_KEY)
    if (pendingProvider) {
      sessionStorage.setItem(SAML_ACTIVE_PROVIDER_KEY, pendingProvider)
      sessionStorage.removeItem(SAML_PENDING_PROVIDER_KEY)
    }

    navigate(returnTo && returnTo.startsWith('/') ? returnTo : '/dashboard', { replace: true })
  }

  const exchange = useMutation({
    mutationFn: (c: string) => samlAuthService.exchange(c),
    onSuccess: finishSignIn,
  })
  // The sign-in worked but the account is in use on another browser.
  const takeover = exchange.isError ? activeSessionPrompt(exchange.error) : null

  useEffect(() => {
    if (started.current || !code) return
    started.current = true
    exchange.mutate(code)
    // Fire exactly once per mount, keyed off the code in the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const failed = !code || (exchange.isError && !takeover) || (exchange.isSuccess && !exchange.data?.success)

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm">
        {takeover ? (
          <div className="text-left">
            <h1 className="mb-4 text-center text-sm font-bold text-stone-900">Already signed in</h1>
            <TakeoverPrompt
              prompt={takeover}
              onSuccess={finishSignIn}
              onCancel={() => navigate('/auth/login', { replace: true })}
            />
          </div>
        ) : failed ? (
          <>
            <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="size-5 text-red-500" />
            </span>
            <h1 className="text-sm font-bold text-stone-900">Sign-in link expired</h1>
            <p className="mt-1.5 text-xs text-stone-500">
              {code
                ? apiErrorMessage(exchange.error, 'That sign-in link has expired. Please try again.')
                : 'This sign-in link is missing its code. Please try again.'}
            </p>
            <Link
              to="/auth/login"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-stone-950 transition hover:bg-brand/80"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto mb-3 size-6 animate-spin text-stone-400" aria-hidden="true" />
            <h1 className="text-sm font-bold text-stone-900">Signing you in…</h1>
            <p className="mt-1.5 text-xs text-stone-500">Just a moment.</p>
          </>
        )}
      </div>
    </div>
  )
}
