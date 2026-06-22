import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, ArrowRight, Loader2, Mail, MailCheck, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { authService } from '@/services/authService'
import { apiErrorMessage } from '@/api/tenantClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
})
type Fields = z.infer<typeof schema>

// ─── Hero panel shared with LoginPage visual style ────────────────────────────

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
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-label lg:px-4 lg:py-1.5 font-medium tracking-wide text-white backdrop-blur-sm transition-transform hover:scale-105">
            Secure Recovery
          </div>
        </div>

        <div className="max-w-xl">
          <div className="mb-4 inline-flex transform items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 lg:px-4 lg:py-2 transition-all hover:-translate-y-1 hover:bg-brand/20">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand"></span>
            </span>
            <span className="text-2xs lg:text-xs font-semibold uppercase tracking-widest text-brand">
              Account Recovery
            </span>
          </div>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white md:text-4xl lg:text-5xl">
            Regain access to <br />
            <span className="bg-gradient-to-r from-brand via-brand-hover to-brand-dark bg-clip-text text-transparent">
              your workspace.
            </span>
          </h1>
          <p className="mt-4 max-w-lg text-sm lg:text-base leading-relaxed text-white/60">
            We'll send a secure, one-time reset link to your inbox. Your data stays
            protected throughout the entire process.
          </p>
          <div className="mt-6 grid max-w-lg gap-3 sm:grid-cols-2 lg:mt-8">
            <div className="group cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-4 lg:p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
              <div className="mb-2 inline-flex rounded-lg bg-brand/20 p-1.5 lg:p-2 text-brand transition-transform group-hover:scale-110 group-hover:bg-brand/30">
                <ShieldCheck className="size-4 lg:size-5" />
              </div>
              <h3 className="text-xs lg:text-sm font-semibold text-white">Zero-Trust Reset</h3>
              <p className="mt-1 text-label lg:text-xs leading-relaxed text-white/40">
                Every link is single-use and expires in 24 hours.
              </p>
            </div>
            <div className="group cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-4 lg:p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
              <div className="mb-2 inline-flex rounded-lg bg-brand/20 p-1.5 lg:p-2 text-brand transition-transform group-hover:scale-110 group-hover:bg-brand/30">
                <MailCheck className="size-4 lg:size-5" />
              </div>
              <h3 className="text-xs lg:text-sm font-semibold text-white">Instant Delivery</h3>
              <p className="mt-1 text-label lg:text-xs leading-relaxed text-white/40">
                Reset email arrives in seconds — check spam if needed.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-4 lg:pt-6">
          <p className="text-2xs lg:text-xs font-medium uppercase tracking-widest text-white/30">
            © {new Date().getFullYear()} Stone Suite
          </p>
        </div>
      </div>
    </aside>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [serverMessage, setServerMessage] = useState('')

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: Fields) => {
    try {
      const res = await authService.forgotPassword(data.email)
      setServerMessage(res.message ?? 'If that email is registered, a reset link has been sent.')
      setSent(true)
    } catch (err: unknown) {
      setError('root', { message: apiErrorMessage(err, 'Something went wrong. Please try again.') })
    }
  }

  return (
    <div
      className="min-h-screen md:h-screen md:overflow-hidden md:flex md:flex-row font-sans"
    >
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

          {/* Card */}
          <div
            className="relative overflow-hidden rounded-3xl bg-white/80 p-7 backdrop-blur-xl sm:p-9"
            style={{ border: '1px solid rgba(0,95,115,0.1)', boxShadow: '0 32px 72px -12px rgba(0,95,115,0.14), 0 8px 24px -4px rgba(0,0,0,0.05), 0 0 0 1px rgba(255,255,255,0.85) inset' }}
          >
            {/* Top shimmer */}
            <div className="absolute left-10 right-10 top-0 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(0,95,115,0.25), transparent)' }} />
            {/* Corner accent dots */}
            <div className="absolute right-4 top-4 flex gap-1" aria-hidden="true">
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: 'rgba(0,95,115,0.18)' }} />
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: 'rgba(0,95,115,0.1)' }} />
            </div>

            {sent ? (
              /* ── Success state ── */
              <div className="text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand/30 bg-brand/10">
                  <MailCheck className="size-8 text-brand-dark" />
                </div>
                <h2 className="font-brand text-2xl font-bold tracking-tight text-stone-950">Request submitted</h2>
                <p className="mt-2 text-sm font-light text-stone-400">{serverMessage}</p>
                <p className="mt-3 text-xs leading-relaxed text-stone-400">
                  If a link was sent, it expires in 24 hours. Check your spam folder or{' '}
                  <button
                    type="button"
                    onClick={() => setSent(false)}
                    className="font-semibold text-stone-600 underline underline-offset-2 transition-colors hover:text-stone-950"
                    aria-label="Try a different email address"
                  >
                    try another email
                  </button>
                  .
                </p>
                <div className="mt-8">
                  <Link
                    to="/auth/login"
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-stone-950 transition-all duration-200 hover:bg-brand-hover active:scale-[0.99]"
                    style={{ boxShadow: '0 4px 16px rgba(163,230,53,0.28)' }}
                  >
                    Back to sign in <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            ) : (
              /* ── Email form ── */
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
                  <h2 className="text-2xl font-semibold tracking-tight text-stone-950">Forgot password?</h2>
                  <p className="mt-2 text-sm font-light text-stone-400">Enter your email and we'll send you a reset link.</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-2xs font-bold uppercase tracking-[0.2em] text-stone-400">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-300" />
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="name@company.com"
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? 'email-error' : undefined}
                        {...register('email')}
                        className="h-11 rounded-xl border-stone-200 bg-white pl-10 text-stone-950 placeholder:text-stone-300 transition-colors duration-150"
                      />
                    </div>
                    {errors.email && <p id="email-error" className="text-xs text-destructive">{errors.email.message}</p>}
                  </div>

                  {errors.root && (
                    <div className="rounded-md border border-destructive/15 bg-destructive/5 p-2 text-sm font-medium text-destructive">
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
                      <><Loader2 className="mr-2 size-4 animate-spin" />Sending reset link…</>
                    ) : (
                      <>Send reset link <ArrowRight className="ml-2 size-4" /></>
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
              </>
            )}
          </div>
        </div>
      </main>

      <HeroPanel />
    </div>
  )
}
