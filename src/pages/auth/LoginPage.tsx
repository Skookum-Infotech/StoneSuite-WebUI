import { useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Lock, Mail, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/store/useAuthStore'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FaAws } from 'react-icons/fa'

function OAuthButton({
  icon,
  label,
}: {
  icon: ReactNode
  label: string
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full justify-center gap-2 rounded-xl border-stone-200 bg-white px-2 text-stone-700 shadow-sm transition-all duration-200 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950 focus-visible:ring-stone-400/20"
    >
      <span className="flex size-5 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="truncate text-xs font-semibold sm:text-sm">{label}</span>
    </Button>
  )
}



export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await authService.login({ email, password, rememberMe: false })
      if (response.success && response.user && response.token) {
        setAuth(response.user, response.token)
        navigate('/dashboard')
      } else {
        setError(response.message || 'Login failed')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'An error occurred during login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen md:h-screen md:overflow-hidden md:flex md:flex-row"
      style={{ fontFamily: "'DM Sans', 'Geist', system-ui, sans-serif" }}
    >
      {/* ── LEFT — Login ── */}
      <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden md:min-h-0 md:h-full bg-stone-50 px-4 py-12 text-stone-950 sm:px-6 md:w-1/2 lg:px-10">
        {/* Subtle texture overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        {/* Radial glow top-right */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-amber-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-stone-200/80 blur-3xl" />

        <div className="relative w-full max-w-sm sm:max-w-md">
          {/* Card */}
          <div className="rounded-3xl border border-stone-200/80 bg-white/80 p-7 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.15),0_0_0_1px_rgba(255,255,255,0.9)_inset] backdrop-blur-sm sm:p-9">

            {/* Logo + heading */}
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 flex h-10 w-20 items-center justify-center">
                <img
                  src="/logo-dark.png"
                  alt="Stone Suite logo"
                  className="h-24 w-auto object-contain"
                  onError={(e) => {
                    // fallback if logo missing
                    (e.currentTarget as HTMLImageElement).style.display = 'none'
                    const parent = e.currentTarget.parentElement
                    if (parent) {
                      parent.innerHTML = '<span style="color:white;font-size:1.25rem;font-weight:700">S</span>'
                    }
                  }}
                />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-stone-950">
                Welcome back
              </h2>
              <p className="mt-2 text-sm text-stone-500">
                Sign in to your Stone Suite workspace
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-widest text-stone-500">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-xl border-stone-200 bg-stone-50/80 pl-10 text-stone-950 placeholder:text-stone-400 focus-visible:border-stone-400 focus-visible:bg-white focus-visible:ring-stone-300/40 transition-colors duration-150"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-widest text-stone-500">
                    Password
                  </Label>
                  <a href="#" className="text-xs font-medium text-stone-400 hover:text-stone-700 transition-colors duration-150">
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 rounded-xl border-stone-200 bg-stone-50/80 pl-10 text-stone-950 placeholder:text-stone-400 focus-visible:border-stone-400 focus-visible:bg-white focus-visible:ring-stone-300/40 transition-colors duration-150"
                  />
                </div>
              </div>

              {error && (
                <div className="text-sm font-medium text-red-500 bg-red-50 p-2 rounded-md border border-red-100">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="mt-1 h-11 w-full rounded-xl bg-[#c2f589] text-sm font-semibold text-stone-950 transition-all duration-200 hover:bg-[#99c466] active:scale-[0.99] focus-visible:ring-stone-400/30 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="ml-2 size-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-stone-200" />
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-stone-400">or</span>
              <div className="h-px flex-1 bg-stone-200" />
            </div>

            {/* OAuth */}
            <div className="flex flex-col items-center space-y-3">
              <span className="text-sm font-medium text-stone-500">Continue with</span>
              <div className="grid w-full grid-cols-2 gap-3">
                <OAuthButton
                  label="Microsoft Entra ID"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" className="size-5">
                      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                    </svg>
                  }
                />
                <OAuthButton
                  label="AWS Cognito"
                  icon={<FaAws className="size-5 text-[#FF9900]" />}
                />
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-stone-400">
              Protected by enterprise-grade security
            </p>
          </div>
        </div>
      </main>

      {/* ── RIGHT — Hero ── */}
      <aside className="relative hidden h-screen w-1/2 flex-col overflow-hidden md:flex">
        <div className="absolute inset-0 bg-[#0B1110]" />

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_20%_12%,rgba(196,255,139,0.13),transparent_62%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_90%_88%,rgba(20,184,166,0.11),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.05),transparent_40%,rgba(0,0,0,0.28))]" />

        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
        linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px),
        linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)
      `,
            backgroundSize: '84px 84px',
          }}
        />

        <div className="absolute -right-24 top-24 h-64 w-64 rotate-12 rounded-[2rem] border border-white/10 bg-white/[0.035] shadow-2xl backdrop-blur-sm" />
        <div className="absolute -right-8 top-40 h-36 w-36 rotate-12 rounded-[1.5rem] border border-[#C4FF8B]/15 bg-[#C4FF8B]/[0.04]" />

        <div className="relative z-10 flex h-full flex-col justify-between p-8 lg:p-10">
          {/* Top */}
          <div className="flex items-center justify-between">
            <div className="flex h-14 w-24 items-center">
              <img
                src="/logo-white.png"
                alt="Stone Suite"
                className="h-20 w-auto object-contain"
                onError={(e) => {
                  ; (e.currentTarget as HTMLImageElement).style.display = 'none'
                  const parent = e.currentTarget.parentElement
                  if (parent)
                    parent.innerHTML =
                      '<span style="color:white;font-size:0.9rem;font-weight:700">S</span>'
                }}
              />
            </div>

            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-stone-300">
              Stone ERP
            </div>
          </div>

          {/* Middle */}
          <div className="max-w-xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#C4FF8B]/20 bg-[#C4FF8B]/10 px-3.5 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C4FF8B]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C4FF8B]">
                Built for stone operations
              </span>
            </div>

            <h1 className="text-4xl font-bold leading-[1.04] tracking-tight text-white lg:text-5xl xl:text-[3.35rem]">
              Manage every stone job with{' '}
              <span className="bg-gradient-to-r from-[#C4FF8B] via-[#9EF06B] to-[#38BDF8] bg-clip-text text-transparent">
                clarity.
              </span>
            </h1>

            <p className="mt-5 max-w-md text-base leading-relaxed text-stone-400">
              A focused ERP workspace for daily operations, material flow,
              fabrication progress, and team coordination.
            </p>

            <div className="mt-6 grid max-w-lg gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3.5 backdrop-blur-sm">
                <p className="text-sm font-semibold text-white">Operations control</p>
                <p className="mt-1 text-xs leading-relaxed text-stone-400">
                  Organize work orders, teams, and daily activity.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3.5 backdrop-blur-sm">
                <p className="text-sm font-semibold text-white">Material visibility</p>
                <p className="mt-1 text-xs leading-relaxed text-stone-400">
                  Track slabs, stock movement, and fabrication readiness.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-stone-500">
              Designed for fabrication workflows
            </p>

            <div className="flex shrink-0 items-center gap-2 text-xs text-stone-400">
              <span className="h-2 w-2 rounded-full bg-[#C4FF8B]" />
              Secure access
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}