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
import { LoginHero } from './components/LoginHero'
import type { UserRole, AuthResponse, IdentifyResult } from '@/types/auth'
import type { SAMLProvider } from '@/types/tenant'

type Step = 'email' | 'password' | 'redirecting'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const setPortalAuth = useAuthStore((state) => state.setPortalAuth)
  const [searchParams] = useSearchParams()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [redirectProvider, setRedirectProvider] = useState<SAMLProvider | null>(null)

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

  return (
    <div
      className="h-screen overflow-hidden flex flex-col md:flex-row font-sans"
    >
      {/* ── LEFT — Login ── */}
      <main
        className="relative flex h-full w-full items-center justify-center overflow-hidden px-4 py-2 md:py-6 text-stone-950 sm:px-6 md:w-1/2 lg:px-10"
        style={{ background: 'linear-gradient(150deg, #f9fafa 0%, #f2f7f8 45%, #e8f3f5 100%)' }}
      >
        {/* Fine teal grid */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(0,95,115,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(0,95,115,0.045) 1px, transparent 1px)`,
            backgroundSize: '44px 44px',
          }}
        />

        {/* Concentric circles — top right */}
        <div className="pointer-events-none absolute right-0 top-0 overflow-hidden">
          <svg width="220" height="220" viewBox="0 0 220 220" fill="none" aria-hidden="true">
            <circle cx="220" cy="0" r="80"  stroke="rgba(0,95,115,0.09)" strokeWidth="0.75" />
            <circle cx="220" cy="0" r="120" stroke="rgba(0,95,115,0.06)" strokeWidth="0.75" />
            <circle cx="220" cy="0" r="165" stroke="rgba(0,95,115,0.04)" strokeWidth="0.75" />
          </svg>
        </div>

        {/* Concentric circles — bottom left */}
        <div className="pointer-events-none absolute bottom-0 left-0 overflow-hidden">
          <svg width="160" height="160" viewBox="0 0 160 160" fill="none" aria-hidden="true">
            <circle cx="0" cy="160" r="60"  stroke="rgba(0,95,115,0.07)" strokeWidth="0.75" />
            <circle cx="0" cy="160" r="100" stroke="rgba(0,95,115,0.04)" strokeWidth="0.75" />
          </svg>
        </div>

        {/* Dot cluster — left-center */}
        <div className="pointer-events-none absolute left-6 top-1/3 hidden md:block" aria-hidden="true">
          {Array.from({ length: 4 }, (_, row) => (
            <div key={row} className="flex gap-2 mb-2">
              {Array.from({ length: 4 }, (_, col) => (
                <div key={col} className="h-0.5 w-0.5 rounded-full bg-[#005f73]/25" />
              ))}
            </div>
          ))}
        </div>

        {/* Soft glow pools */}
        <div className="pointer-events-none absolute right-0 top-1/4 h-72 w-72 -translate-y-1/2 rounded-full blur-3xl" style={{ background: 'rgba(0,95,115,0.07)' }} />
        <div className="pointer-events-none absolute -left-8 bottom-1/4 h-52 w-52 rounded-full blur-3xl" style={{ background: 'rgba(163,230,53,0.07)' }} />

        <div className="relative w-full max-w-sm sm:max-w-lg">

          {/* Eyebrow label above card */}
          <div className="mb-5 hidden md:flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, rgba(0,95,115,0.2))' }} />
            <span className="text-2xs font-bold uppercase tracking-[0.35em]" style={{ color: 'rgba(0,95,115,0.45)' }}>Workspace Portal</span>
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, transparent, rgba(0,95,115,0.2))' }} />
          </div>

          {/* Card */}
          <div
            className="relative overflow-hidden rounded-3xl bg-white/80 p-6 backdrop-blur-xl sm:p-10"
            style={{
              border: '1px solid rgba(0,95,115,0.1)',
              boxShadow: '0 32px 72px -12px rgba(0,95,115,0.14), 0 8px 24px -4px rgba(0,0,0,0.05), 0 0 0 1px rgba(255,255,255,0.85) inset',
            }}
          >
            {/* Top shimmer line */}
            <div className="absolute left-10 right-10 top-0 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(0,95,115,0.25), transparent)' }} />

            {/* Corner accent dots */}
            <div className="absolute right-4 top-4 flex gap-1" aria-hidden="true">
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: 'rgba(0,95,115,0.18)' }} />
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: 'rgba(0,95,115,0.1)' }} />
            </div>

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
                  <h2 className="text-xl font-semibold tracking-tight text-stone-950 sm:text-2xl">
                    Redirecting to {redirectProvider ? samlProviderLabel(redirectProvider) : 'your identity provider'}…
                  </h2>
                  <p className="mt-1 text-xs text-stone-500 sm:mt-2 sm:text-sm">
                    Just a moment.
                  </p>
                </>
              ) : (
                <>
                  <div className="mx-auto mb-2 flex h-12 w-28 items-center justify-center sm:mb-5 sm:h-20 sm:w-40">
                    <img
                      src="/logo-dark.png"
                      alt="Stone Suite logo"
                      className="h-16 w-auto object-contain sm:h-32"
                      onError={(e) => {
                        ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                        const parent = e.currentTarget.parentElement
                        if (parent) parent.innerHTML = '<span style="color:#001219;font-size:1.25rem;font-weight:700">S</span>'
                      }}
                    />
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight text-stone-950 sm:text-2xl">Welcome back</h2>
                  <p className="mt-1 text-xs text-stone-500 sm:mt-2 sm:text-sm">
                    {step === 'password' ? 'Enter your password to continue' : 'Sign in to your Stone Suite workspace'}
                  </p>
                </>
              )}
            </div>

            {step === 'email' && loggedOut && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="size-4 shrink-0" />
                You&apos;ve been signed out.
              </div>
            )}

            {step === 'redirecting' ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-6 animate-spin text-stone-400" aria-hidden="true" />
              </div>
            ) : step === 'password' ? (
              <PasswordStep email={email} onSuccess={handleLoginSuccess} onBack={handleBack} />
            ) : (
              <EmailStep defaultEmail={email} onIdentified={handleIdentified} />
            )}

            {/* Footer */}
            <div className="mt-4 hidden items-center justify-center gap-1.5 sm:flex sm:mt-8">
              <Lock className="size-3 text-stone-300" aria-hidden="true" />
              <p className="text-center text-xs text-stone-300">Protected by enterprise-grade security</p>
            </div>
          </div>
        </div>
      </main>

      {/* ── RIGHT — Hero ── */}
      <LoginHero />
    </div>
  )
}
