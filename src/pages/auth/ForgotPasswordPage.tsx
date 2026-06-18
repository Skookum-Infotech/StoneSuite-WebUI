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
    <aside className="relative hidden h-screen w-1/2 flex-col overflow-hidden bg-slate-950 md:flex">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-stone-900 to-slate-950" />
      <div
        className="absolute -left-40 -top-40 h-[500px] w-[500px] animate-pulse rounded-full bg-brand/10 blur-[120px]"
        style={{ animationDuration: '4s' }}
      />
      <div
        className="absolute -bottom-40 -right-40 h-[500px] w-[500px] animate-pulse rounded-full bg-amber-500/10 blur-[120px]"
        style={{ animationDuration: '5s', animationDelay: '1s' }}
      />
      <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 animate-[spin_40s_linear_infinite] rounded-full bg-gradient-to-r from-transparent via-brand/5 to-transparent blur-3xl" />
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
            <span className="bg-gradient-to-r from-brand via-amber-400 to-yellow-300 bg-clip-text text-transparent">
              your workspace.
            </span>
          </h1>
          <p className="mt-4 max-w-lg text-sm lg:text-base leading-relaxed text-slate-300">
            We'll send a secure, one-time reset link to your inbox. Your data stays
            protected throughout the entire process.
          </p>
          <div className="mt-6 grid max-w-lg gap-3 sm:grid-cols-2 lg:mt-8">
            <div className="group cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-4 lg:p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
              <div className="mb-2 inline-flex rounded-lg bg-brand/20 p-1.5 lg:p-2 text-brand transition-transform group-hover:scale-110 group-hover:bg-brand/30">
                <ShieldCheck className="size-4 lg:size-5" />
              </div>
              <h3 className="text-xs lg:text-sm font-semibold text-white">Zero-Trust Reset</h3>
              <p className="mt-1 text-label lg:text-xs leading-relaxed text-slate-400">
                Every link is single-use and expires in 24 hours.
              </p>
            </div>
            <div className="group cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-4 lg:p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
              <div className="mb-2 inline-flex rounded-lg bg-emerald-500/20 p-1.5 lg:p-2 text-emerald-400 transition-transform group-hover:scale-110 group-hover:bg-emerald-500/30">
                <MailCheck className="size-4 lg:size-5" />
              </div>
              <h3 className="text-xs lg:text-sm font-semibold text-white">Instant Delivery</h3>
              <p className="mt-1 text-label lg:text-xs leading-relaxed text-slate-400">
                Reset email arrives in seconds — check spam if needed.
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

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [sentTo, setSentTo] = useState('')

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: Fields) => {
    try {
      await authService.forgotPassword(data.email)
      setSentTo(data.email)
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
      <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden md:min-h-0 md:h-full bg-stone-50 px-4 py-12 text-stone-950 sm:px-6 md:w-1/2 lg:px-10">
        {/* Noise texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E")`,
          }}
        />
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-amber-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-stone-200/80 blur-3xl" />

        <div className="relative w-full max-w-sm sm:max-w-md">
          <div className="rounded-3xl border border-stone-200/80 bg-white/80 p-7 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.15),0_0_0_1px_rgba(255,255,255,0.9)_inset] backdrop-blur-sm sm:p-9">

            {sent ? (
              /* ── Success state ── */
              <div className="text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-100 bg-amber-50">
                  <MailCheck className="size-8 text-amber-500" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-stone-950">Check your inbox</h2>
                <p className="mt-2 text-sm text-stone-500">
                  We sent a password reset link to{' '}
                  <span className="font-semibold text-stone-700">{sentTo}</span>
                </p>
                <p className="mt-3 text-xs text-stone-400 leading-relaxed">
                  The link expires in 24 hours. Didn&apos;t receive it?{' '}
                  Check your spam folder or{' '}
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
                        if (parent)
                          parent.innerHTML =
                            '<span style="color:#1c1917;font-size:1.25rem;font-weight:700">S</span>'
                      }}
                    />
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight text-stone-950">
                    Forgot your password?
                  </h2>
                  <p className="mt-2 text-sm text-stone-500">
                    Enter your email and we&apos;ll send you a reset link.
                  </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="email"
                      className="text-xs font-semibold uppercase tracking-widest text-stone-500"
                    >
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="name@company.com"
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? 'email-error' : undefined}
                        {...register('email')}
                        className="h-11 rounded-xl border-stone-200 bg-stone-50/80 pl-10 text-stone-950 placeholder:text-stone-400 focus-visible:border-stone-400 focus-visible:bg-white focus-visible:ring-stone-300/40 transition-colors duration-150"
                      />
                    </div>
                    {errors.email && (
                      <p id="email-error" className="text-xs text-red-500">
                        {errors.email.message}
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
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Sending reset link…
                      </>
                    ) : (
                      <>
                        Send reset link <ArrowRight className="ml-2 size-4" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <Link
                    to="/auth/login"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors duration-150 hover:text-stone-900"
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
