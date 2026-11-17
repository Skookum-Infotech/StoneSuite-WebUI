import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, ArrowRight, ClipboardList, Loader2, Mail, MailCheck, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { authService } from '@/services/authService'
import { apiErrorMessage } from '@/api/tenantClient'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { AuthHero, type AuthHeroCopy, type AuthHeroFeature } from './components/AuthHero'
import { AuthLogo, AuthPanel } from './components/AuthPanel'
import { SIGN_IN_BUTTON } from './components/authStyles'

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
})
type Fields = z.infer<typeof schema>

// ─── Hero panel ───────────────────────────────────────────────────────────────

const HERO_COPY: AuthHeroCopy = {
  badge: 'Account Recovery',
  lead: 'Regain access to',
  accent: 'your workspace.',
  description: "We'll send a secure, one-time reset link to your inbox. Your data stays protected throughout the entire process.",
}

const HERO_FEATURES: AuthHeroFeature[] = [
  { icon: <ShieldCheck className="size-4" />, title: 'Zero-Trust Reset', text: 'Every link is single-use and expires in 24 hours.' },
  { icon: <MailCheck className="size-4" />, title: 'Instant Delivery', text: 'Reset email arrives in seconds — check spam if needed.' },
  { icon: <ClipboardList className="size-4" />, title: 'Full Audit Trail', text: 'Every reset is logged and fully traceable.' },
]

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
    <div className="min-h-screen md:h-screen md:overflow-hidden md:flex md:flex-row font-sans">
      {/* ── LEFT — Form ── */}
      <AuthPanel>
        {sent ? (
          /* ── Success state ── */
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand/30 bg-brand/10">
              <MailCheck className="size-8 text-link" />
            </div>
            <h2 className="type-display">Request Submitted</h2>
            <p className="mt-2 text-body text-ink-muted">{serverMessage}</p>
            <p className="mt-3 type-helper leading-relaxed">
              If a link was sent, it expires in 24 hours. Check your spam folder or{' '}
              <button
                type="button"
                onClick={() => setSent(false)}
                className="font-semibold text-ink underline underline-offset-2 transition-colors hover:text-ink-strong"
                aria-label="Try a different email address"
              >
                try another email
              </button>
              .
            </p>
            <div className="mt-8">
              <Link to="/auth/login" className={cn(buttonVariants({ size: 'lg' }), SIGN_IN_BUTTON)}>
                Back to sign in <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        ) : (
          /* ── Email form ── */
          <>
            <div className="mb-8 text-center">
              <AuthLogo />
              <h2 className="type-display">Forgot Password?</h2>
              <p className="mt-2 text-body text-ink-muted">Enter your email and we'll send you a reset link.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
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
                    className="auth-field h-11 rounded-xl border-stone-200 bg-white pl-10 transition-colors duration-150"
                  />
                </div>
                {errors.email && <p id="email-error" className="type-error">{errors.email.message}</p>}
              </div>

              {errors.root && (
                <div className="rounded-md border border-destructive/15 bg-destructive/5 p-2 type-error">
                  {errors.root.message}
                </div>
              )}

              <Button type="submit" size="lg" disabled={isSubmitting} className={cn('mt-1', SIGN_IN_BUTTON)}>
                {isSubmitting ? (
                  <><Loader2 className="size-4 animate-spin" />Sending reset link…</>
                ) : (
                  <>Send reset link <ArrowRight className="size-4" /></>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link
                to="/auth/login"
                className="inline-flex items-center gap-1.5 text-body font-medium text-ink-muted transition-colors duration-150 hover:text-ink-strong"
                aria-label="Go back to sign in"
              >
                <ArrowLeft className="size-3.5" />
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </AuthPanel>

      <AuthHero copy={HERO_COPY} features={HERO_FEATURES} />
    </div>
  )
}
