import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Loader2, Lock } from 'lucide-react'
import { FaAws } from 'react-icons/fa'
import { MicrosoftLogo } from '@/components/icons/MicrosoftLogo'
import { samlAuthService } from '@/services/samlAuthService'
import { useAuthStore } from '@/store/useAuthStore'
import { userService } from '@/services/tenantServices'
import { samlProviderLabel } from '@/lib/ssoConfigForm'
import { SAML_PENDING_PROVIDER_KEY } from '@/lib/samlSession'
import { EmailStep } from './components/EmailStep'
import { PasswordStep } from './components/PasswordStep'
import { CodeStep } from './components/CodeStep'
import { TakeoverPrompt } from './components/TakeoverPrompt'
import { AuthNotice } from './components/AuthNotice'
import { LoginHero } from './components/LoginHero'
import { AuthLogo, AuthPanel } from './components/AuthPanel'
import type { UserRole, AuthResponse, IdentifyResult, MfaChallenge, ActiveSessionPrompt } from '@/types/auth'
import type { SAMLProvider } from '@/types/tenant'

type Step = 'email' | 'password' | 'code' | 'takeover' | 'redirecting'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const setPortalAuth = useAuthStore((state) => state.setPortalAuth)
  const [searchParams] = useSearchParams()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [redirectProvider, setRedirectProvider] = useState<SAMLProvider | null>(null)
  // Set while the code step is showing: the password was right, a code was
  // emailed, and no session exists until it is entered.
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null)
  // Set while asking whether to end the session open on another browser.
  const [takeover, setTakeover] = useState<ActiveSessionPrompt | null>(null)

  const loggedOut = searchParams.get('logged_out') === 'true'

  // EmailStep already resolved the email (POST /auth/identify) -- either
  // show the password field, or hand off to that provider's SAML flow with
  // a full-page redirect. sessionStorage records which provider is pending
  // so SsoCallbackPage/logout can key off it later (see lib/samlSession).
  function handleIdentified(identifiedEmail: string, result: IdentifyResult) {
    setEmail(identifiedEmail)
    if (result.method === 'password') {
      setStep('password')
      return
    }
    setRedirectProvider(result.provider)
    setStep('redirecting')
    const returnTo = searchParams.get('return_to') ?? undefined
    sessionStorage.setItem(SAML_PENDING_PROVIDER_KEY, result.provider)
    window.location.href = samlAuthService.initiateUrl(result.provider, {
      tenantId: result.tenantId,
      returnTo,
    })
  }

  async function handleLoginSuccess(response: AuthResponse) {
    // PasswordStep only calls this once user/token/expiresAt are confirmed
    // present, but narrow again since AuthResponse's fields are optional.
    if (!response.user || !response.token || !response.expiresAt) return
    const expiresAt = response.expiresAt

    // A customer-portal identity landed here too (one login box, see
    // controllers/tenant.go's tryPortalLogin) — must branch BEFORE the staff
    // role-enrichment call below. That call hits /api/tenant/users, which a
    // portal-kind token is structurally confined away from (RequireAuth's
    // path confinement) and would 403.
    if (response.kind === 'portal') {
      setPortalAuth({
        user: response.user,
        token: response.token,
        expiresAt,
        tenantId: response.tenantId ?? '',
        workspaces: response.workspaces ?? [],
      })
      navigate('/sales/sales_order', { replace: true })
      return
    }

    // Set auth BEFORE any subsequent API calls so the in-memory Bearer token
    // is available. On cross-origin deployments (Cloudflare Pages → Fly.io)
    // SameSite=Lax blocks the auth_token cookie from being sent in XHR — the
    // Authorization header is the only credential that works for those requests.
    setAuth(response.user, response.token, expiresAt)

    // Enrich the stored user with workspace roles (non-critical).
    try {
      const workspaceUsers = await userService.listUsers()
      const currentUser = workspaceUsers.find((u) => u.email === response.user!.email)
      if (currentUser?.roles) {
        const roles: UserRole[] = currentUser.roles.map((r) => ({ id: r.id, name: r.name, key: r.key }))
        setAuth({ ...response.user, roles, selectedRoleId: roles[0]?.id }, response.token, expiresAt)
      }
    } catch (err) {
      console.warn('Failed to fetch user roles:', err)
    }

    // replace: true drops /auth/login from the history stack so the browser
    // Back button cannot land a signed-in user back on the sign-in screen.
    navigate('/dashboard', { replace: true })
  }

  function handleBack() {
    setStep('email')
  }

  function handleMfaRequired(next: MfaChallenge) {
    setChallenge(next)
    setStep('code')
  }

  function handleActiveSession(prompt: ActiveSessionPrompt) {
    setTakeover(prompt)
    setStep('takeover')
  }

  // Cancel keeps the other session: start over, signed out.
  function handleTakeoverCancel() {
    setTakeover(null)
    setChallenge(null)
    setStep('email')
  }

  // Back from the code step lands on the password step: the code belongs to
  // that password entry, so asking for a new one means entering it again.
  function handleCodeBack() {
    setChallenge(null)
    setStep('password')
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col md:flex-row font-sans">
      {/* ── LEFT — Login ── */}
      <AuthPanel layout="login">
        {/* Logo + Heading */}
        <div className="mb-4 text-center sm:mb-10">
          {step === 'redirecting' ? (
            <>
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 sm:mb-5 sm:h-16 sm:w-16">
                {redirectProvider === 'entra' ? (
                  <MicrosoftLogo className="size-7" />
                ) : redirectProvider === 'cognito' ? (
                  <FaAws className="size-7 text-[#FF9900]" />
                ) : (
                  <Lock className="size-7 text-stone-400" />
                )}
              </div>
              <h2 className="type-display">
                Redirecting to {redirectProvider ? samlProviderLabel(redirectProvider) : 'Your Identity Provider'}…
              </h2>
              <p className="mt-1 text-body text-ink-muted sm:mt-2">Just a moment.</p>
            </>
          ) : (
            <>
              <AuthLogo size="lg" />
              <h2 className="type-display">
                {step === 'code' ? 'Check Your Email' : step === 'takeover' ? 'Already Signed In' : 'Welcome Back'}
              </h2>
              <p className="mt-1 text-body text-ink-muted sm:mt-2">
                {step === 'code'
                  ? 'Enter the code we emailed you to finish signing in'
                  : step === 'takeover'
                    ? 'Choose where to stay signed in'
                  : step === 'password'
                    ? 'Enter your password to continue'
                    : 'Sign in to your Stone Suite workspace'}
              </p>
            </>
          )}
        </div>

        {step === 'email' && <AuthNotice />}

        {step === 'email' && loggedOut && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-caption font-medium text-success-ink">
            <CheckCircle2 className="size-4 shrink-0" />
            You&apos;ve been signed out.
          </div>
        )}

        {step === 'redirecting' ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-6 animate-spin text-stone-400" aria-hidden="true" />
          </div>
        ) : step === 'takeover' && takeover ? (
          <TakeoverPrompt prompt={takeover} onSuccess={handleLoginSuccess} onCancel={handleTakeoverCancel} />
        ) : step === 'code' && challenge ? (
          <CodeStep
            challenge={challenge}
            onSuccess={handleLoginSuccess}
            onBack={handleCodeBack}
            onActiveSession={handleActiveSession}
          />
        ) : step === 'password' ? (
          <PasswordStep
            email={email}
            onSuccess={handleLoginSuccess}
            onMfaRequired={handleMfaRequired}
            onActiveSession={handleActiveSession}
            onBack={handleBack}
          />
        ) : (
          <EmailStep defaultEmail={email} onIdentified={handleIdentified} />
        )}

        {/* Footer */}
        <div className="mt-4 hidden items-center justify-center gap-1.5 sm:flex sm:mt-8">
          <Lock className="size-3 text-stone-400" aria-hidden="true" />
          <p className="text-center type-helper">Protected by enterprise-grade security</p>
        </div>
      </AuthPanel>

      {/* ── RIGHT — Hero ── */}
      <LoginHero />
    </div>
  )
}
