import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { authService } from '@/services/authService'
import { apiErrorMessage } from '@/api/tenantClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must include an uppercase letter')
      .regex(/[0-9]/, 'Must include a number'),
    confirm: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  })

type Fields = z.infer<typeof schema>

// ─── Hero panel ───────────────────────────────────────────────────────────────

function HeroPanel() {
  return (
    <aside className="relative hidden h-screen w-1/2 flex-col overflow-hidden md:flex" style={{ background: 'var(--gradient-header)' }}>
      <div className="absolute -left-40 -top-40 h-[500px] w-[500px] animate-pulse rounded-full bg-[#005f73]/25 blur-[120px]" style={{ animationDuration: '4s' }} />
      <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] animate-pulse rounded-full bg-brand/10 blur-[120px]" style={{ animationDuration: '5s', animationDelay: '1s' }} />
      <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 animate-[spin_40s_linear_infinite] rounded-full bg-gradient-to-r from-transparent via-[#005f73]/10 to-transparent blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.2]"
        style={{
          backgroundImage: `radial-gradient(circle at center, #ffffff 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />
      <style>{`
        @keyframes float-slow { 0%, 100% { transform: translate(0, 0) rotate(0deg); } 50% { transform: translate(0, -20px) rotate(3deg); } }
        .animate-float-slow { animation: float-slow 6s ease-in-out infinite; }
        .animate-float-delayed { animation: float-slow 7s ease-in-out infinite 2s; }
      `}</style>
      <div className="absolute right-16 top-1/4 h-32 w-32 animate-float-slow rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-md" />
      <div className="absolute bottom-1/3 left-16 h-20 w-20 animate-float-delayed rounded-full border border-brand/20 bg-brand/10 shadow-2xl backdrop-blur-md" />

      <div className="relative z-10 flex h-full flex-col justify-between p-8 lg:p-12">
        <div className="flex items-center justify-between">
          <div className="flex h-10 items-center lg:h-12">
            <img
              src="/logo-white.png"
              alt="Stone Suite"
              className="h-full w-auto object-contain drop-shadow-lg"
              onError={(e) => {
                ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                const parent = e.currentTarget.parentElement
                if (parent)
                  parent.innerHTML =
                    '<span style="color:white;font-size:1.15rem;font-weight:700;letter-spacing:0.05em">STONE SUITE</span>'
              }}
            />
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-label lg:px-4 lg:py-1.5 font-medium tracking-wide text-white backdrop-blur-sm">
            New Password
          </div>
        </div>

        <div className="max-w-xl">
          <div className="mb-4 inline-flex transform items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 lg:px-4 lg:py-2 transition-all hover:-translate-y-1 hover:bg-brand/20">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand"></span>
            </span>
            <span className="text-2xs lg:text-xs font-semibold uppercase tracking-widest text-brand">
              Password Reset
            </span>
          </div>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white md:text-4xl lg:text-5xl">
            Create a stronger <br />
            <span className="bg-gradient-to-r from-brand via-emerald-400 to-teal-400 bg-clip-text text-transparent">
              new password.
            </span>
          </h1>
          <p className="mt-4 max-w-lg text-sm lg:text-base leading-relaxed text-slate-300">
            Choose something memorable yet secure. A strong password uses a mix of
            uppercase letters, numbers, and symbols.
          </p>
          <div className="mt-6 grid max-w-lg gap-3 sm:grid-cols-2 lg:mt-8">
            <div className="group cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-4 lg:p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
              <div className="mb-2 inline-flex rounded-lg bg-brand/20 p-1.5 lg:p-2 text-brand transition-transform group-hover:scale-110 group-hover:bg-brand/30">
                <ShieldCheck className="size-4 lg:size-5" />
              </div>
              <h3 className="text-xs lg:text-sm font-semibold text-white">One-time Link</h3>
              <p className="mt-1 text-label lg:text-xs leading-relaxed text-slate-400">
                This reset link is invalidated the moment you save.
              </p>
            </div>
            <div className="group cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-4 lg:p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
              <div className="mb-2 inline-flex rounded-lg bg-emerald-500/20 p-1.5 lg:p-2 text-emerald-400 transition-transform group-hover:scale-110 group-hover:bg-emerald-500/30">
                <KeyRound className="size-4 lg:size-5" />
              </div>
              <h3 className="text-xs lg:text-sm font-semibold text-white">Encrypted at Rest</h3>
              <p className="mt-1 text-label lg:text-xs leading-relaxed text-slate-400">
                Your password is hashed — never stored in plain text.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-4 lg:pt-6">
          <p className="text-2xs lg:text-xs font-medium uppercase tracking-widest text-slate-500">
            © {new Date().getFullYear()} Stone Suite
          </p>
        </div>
      </div>
    </aside>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const [done, setDone] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Validate the token before showing the form.
  const tokenQuery = useQuery({
    queryKey: ['reset-password-token', token],
    queryFn: () => authService.validateResetToken(token),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity, // token validity doesn't change during the session
  })

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({ resolver: zodResolver(schema) })

  const passwordValue = useWatch({ control, name: 'newPassword', defaultValue: '' })

  const onSubmit = async (data: Fields) => {
    try {
      await authService.resetPassword(token, data.newPassword)
      setDone(true)
      // Redirect to login after a short delay so the success message is visible.
      setTimeout(() => navigate('/auth/login'), 3000)
    } catch (err: unknown) {
      setError('root', { message: apiErrorMessage(err, 'Could not reset password. Please try again.') })
    }
  }

  // Password strength indicator (cosmetic only — validation is via Zod)
  const strength = (() => {
    if (!passwordValue) return 0
    let score = 0
    if (passwordValue.length >= 8) score++
    if (/[A-Z]/.test(passwordValue)) score++
    if (/[0-9]/.test(passwordValue)) score++
    if (/[^A-Za-z0-9]/.test(passwordValue)) score++
    return score
  })()

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength]
  const strengthColor = ['', 'bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-emerald-500'][strength]

  const card = (children: React.ReactNode) => (
    <div
      className="relative overflow-hidden rounded-3xl bg-white/80 p-7 backdrop-blur-xl sm:p-9"
      style={{ border: '1px solid rgba(0,95,115,0.1)', boxShadow: '0 32px 72px -12px rgba(0,95,115,0.14), 0 8px 24px -4px rgba(0,0,0,0.05), 0 0 0 1px rgba(255,255,255,0.85) inset' }}
    >
      <div className="absolute left-10 right-10 top-0 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(0,95,115,0.25), transparent)' }} />
      <div className="absolute right-4 top-4 flex gap-1" aria-hidden="true">
        <div className="h-1.5 w-1.5 rounded-full" style={{ background: 'rgba(0,95,115,0.18)' }} />
        <div className="h-1.5 w-1.5 rounded-full" style={{ background: 'rgba(0,95,115,0.1)' }} />
      </div>
      {children}
    </div>
  )

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden md:flex md:flex-row font-sans">
      {/* ── LEFT — Form ── */}
      <main
        className="relative flex min-h-screen w-full items-center justify-center overflow-hidden md:min-h-0 md:h-full px-4 py-12 text-stone-950 sm:px-6 md:w-1/2 lg:px-10"
        style={{ background: 'linear-gradient(150deg, #f9fafa 0%, #f2f7f8 45%, #e8f3f5 100%)' }}
      >
        {/* Fine teal grid */}
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: `linear-gradient(rgba(0,95,115,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(0,95,115,0.045) 1px, transparent 1px)`, backgroundSize: '44px 44px' }} />

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

        {/* Dot cluster */}
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

        <div className="relative w-full max-w-sm sm:max-w-md">
          {/* Eyebrow */}
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, rgba(0,95,115,0.2))' }} />
            <span className="text-2xs font-bold uppercase tracking-[0.35em]" style={{ color: 'rgba(0,95,115,0.45)' }}>Workspace Portal</span>
            <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, transparent, rgba(0,95,115,0.2))' }} />
          </div>
          {/* ── Missing token ── */}
          {!token &&
            card(
              <div className="text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-100 bg-red-50">
                  <ShieldAlert className="size-8 text-red-400" />
                </div>
                <h2 className="font-brand text-xl font-bold tracking-tight text-stone-950">Invalid link</h2>
                <p className="mt-2 text-sm text-stone-500">
                  This reset link is missing its token. Please request a new one.
                </p>
                <Link
                  to="/auth/forgot-password"
                  className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-stone-950 transition-all hover:bg-brand-hover"
                >
                  Request new link <ArrowRight className="size-4" />
                </Link>
              </div>,
            )}

          {/* ── Validating token ── */}
          {token && tokenQuery.isPending &&
            card(
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <Loader2 className="size-8 animate-spin text-stone-400" />
                <p className="text-sm font-medium text-stone-500">Verifying your reset link…</p>
              </div>,
            )}

          {/* ── Invalid / expired token ── */}
          {token && tokenQuery.isError &&
            card(
              <div className="text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-100 bg-red-50">
                  <ShieldAlert className="size-8 text-red-400" />
                </div>
                <h2 className="font-brand text-xl font-bold tracking-tight text-stone-950">Link expired</h2>
                <p className="mt-2 text-sm text-stone-500">
                  {apiErrorMessage(tokenQuery.error, 'This reset link is invalid or has expired.')}
                </p>
                <Link
                  to="/auth/forgot-password"
                  className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-stone-950 transition-all hover:bg-brand-hover"
                >
                  Request new link <ArrowRight className="size-4" />
                </Link>
                <div className="mt-3">
                  <Link
                    to="/auth/login"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900"
                  >
                    <ArrowLeft className="size-3.5" /> Back to sign in
                  </Link>
                </div>
              </div>,
            )}

          {/* ── Success state ── */}
          {token && tokenQuery.isSuccess && done &&
            card(
              <div className="text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50">
                  <CheckCircle2 className="size-8 text-emerald-500" />
                </div>
                <h2 className="font-brand text-2xl font-bold tracking-tight text-stone-950">Password updated</h2>
                <p className="mt-2 text-sm font-light text-stone-400">
                  Your password has been reset successfully. Redirecting you to sign in…
                </p>
                <Link
                  to="/auth/login"
                  className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-stone-950 transition-all hover:bg-brand-hover"
                >
                  Sign in now <ArrowRight className="size-4" />
                </Link>
              </div>,
            )}

          {/* ── Reset form ── */}
          {token && tokenQuery.isSuccess && !done &&
            card(
              <>
                <div className="mb-8 text-center">
                  <div className="mx-auto mb-5 flex h-10 w-20 items-center justify-center">
                    <img
                      src="/logo-dark.png"
                      alt="Stone Suite logo"
                      className="h-24 w-auto object-contain"
                      onError={(e) => {
                        ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                        const parent = e.currentTarget.parentElement
                        if (parent) parent.innerHTML = '<span style="color:#001219;font-size:1.25rem;font-weight:700">S</span>'
                      }}
                    />
                  </div>
                  <h2 className="font-brand text-3xl font-bold tracking-tight text-stone-950">Create new password</h2>
                  {tokenQuery.data?.email && (
                    <p className="mt-2 text-sm font-light text-stone-400">
                      for <span className="font-semibold text-stone-600">{tokenQuery.data.email}</span>
                    </p>
                  )}
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {/* New password */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="newPassword"
                      className="text-2xs font-bold uppercase tracking-[0.2em] text-stone-400"
                    >
                      New Password
                    </Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-300" />
                      <Input
                        id="newPassword"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Min 8 characters"
                        aria-invalid={Boolean(errors.newPassword)}
                        aria-describedby={errors.newPassword ? 'pw-error' : undefined}
                        {...register('newPassword')}
                        className="h-11 rounded-xl border-stone-200 bg-white pl-10 pr-11 text-stone-950 placeholder:text-stone-300 transition-colors duration-150"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 transition-colors hover:text-stone-600"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    {errors.newPassword && (
                      <p id="pw-error" className="text-xs text-red-500">
                        {errors.newPassword.message}
                      </p>
                    )}

                    {/* Strength meter */}
                    {passwordValue.length > 0 && (
                      <div className="pt-1">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map((level) => (
                            <div
                              key={level}
                              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                strength >= level ? strengthColor : 'bg-stone-200'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-stone-400">
                          Strength:{' '}
                          <span
                            className={`font-semibold ${
                              strength <= 1
                                ? 'text-red-400'
                                : strength === 2
                                  ? 'text-amber-400'
                                  : strength === 3
                                    ? 'text-blue-400'
                                    : 'text-emerald-500'
                            }`}
                          >
                            {strengthLabel}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="confirm"
                      className="text-2xs font-bold uppercase tracking-[0.2em] text-stone-400"
                    >
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-300" />
                      <Input
                        id="confirm"
                        type={showConfirm ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Repeat your password"
                        aria-invalid={Boolean(errors.confirm)}
                        aria-describedby={errors.confirm ? 'confirm-error' : undefined}
                        {...register('confirm')}
                        className="h-11 rounded-xl border-stone-200 bg-white pl-10 pr-11 text-stone-950 placeholder:text-stone-300 transition-colors duration-150"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 transition-colors hover:text-stone-600"
                      >
                        {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    {errors.confirm && (
                      <p id="confirm-error" className="text-xs text-red-500">
                        {errors.confirm.message}
                      </p>
                    )}
                  </div>

                  {errors.root && (
                    <div className="rounded-md border border-red-100 bg-red-50 p-2 text-sm font-medium text-red-500">
                      {errors.root.message}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="mt-1 h-11 w-full rounded-xl bg-brand text-sm font-semibold text-stone-950 transition-all duration-200 hover:bg-brand-hover active:scale-[0.99] focus-visible:ring-stone-400/30 disabled:cursor-not-allowed disabled:opacity-70"
                    style={{ boxShadow: '0 4px 16px rgba(163,230,53,0.28)' }}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Saving new password…
                      </>
                    ) : (
                      <>
                        Set new password <ArrowRight className="ml-2 size-4" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <Link
                    to="/auth/login"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-400 transition-colors duration-150 hover:text-stone-900"
                    aria-label="Go back to sign in"
                  >
                    <ArrowLeft className="size-3.5" />
                    Back to sign in
                  </Link>
                </div>
              </>,
            )}
        </div>
      </main>

      <HeroPanel />
    </div>
  )
}
