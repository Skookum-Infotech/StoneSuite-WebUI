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
import { strongPasswordSchema } from '@/lib/passwordPolicy'
import { PasswordRequirements } from '@/components/auth/PasswordRequirements'
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { AuthHero, type AuthHeroCopy, type AuthHeroFeature } from './components/AuthHero'
import { AuthLogo, AuthPanel } from './components/AuthPanel'
import { SIGN_IN_BUTTON } from './components/authStyles'

const schema = z
  .object({
    newPassword: strongPasswordSchema,
    confirm: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  })

type Fields = z.infer<typeof schema>

// ─── Hero panel ───────────────────────────────────────────────────────────────

const HERO_COPY: AuthHeroCopy = {
  badge: 'Password Reset',
  lead: 'Create a stronger',
  accent: 'new password.',
  description: 'Choose something memorable yet secure. A strong password uses a mix of uppercase letters, numbers, and symbols.',
}

const HERO_FEATURES: AuthHeroFeature[] = [
  { icon: <ShieldCheck className="size-4" />, title: 'One-time Link', text: 'This reset link is invalidated the moment you save.' },
  { icon: <KeyRound className="size-4" />, title: 'Encrypted at Rest', text: 'Your password is hashed — never stored in plain text.' },
]

const BACK_LINK_CLS = 'inline-flex items-center gap-1.5 text-body font-medium text-ink-muted transition-colors duration-150 hover:text-ink-strong'
const PASSWORD_INPUT_CLS = 'auth-field h-11 rounded-xl border-stone-200 bg-white pl-10 pr-11 transition-colors duration-150'
const REVEAL_BUTTON_CLS = 'absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted transition-colors hover:text-ink'

function RequestNewLink() {
  return (
    <Link to="/auth/forgot-password" className={cn(buttonVariants({ size: 'lg' }), 'mt-6', SIGN_IN_BUTTON)}>
      Request new link <ArrowRight className="size-4" />
    </Link>
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

  let content: React.ReactNode
  if (!token) {
    content = (
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-100 bg-red-50">
          <ShieldAlert className="size-8 text-red-400" />
        </div>
        <h2 className="type-display">Invalid Link</h2>
        <p className="mt-2 text-body text-ink-muted">This reset link is missing its token. Please request a new one.</p>
        <RequestNewLink />
      </div>
    )
  } else if (tokenQuery.isPending) {
    content = (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <Loader2 className="size-8 animate-spin text-stone-400" />
        <p className="text-body font-medium text-ink-muted">Verifying your reset link…</p>
      </div>
    )
  } else if (tokenQuery.isError) {
    content = (
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-100 bg-red-50">
          <ShieldAlert className="size-8 text-red-400" />
        </div>
        <h2 className="type-display">Link Expired</h2>
        <p className="mt-2 text-body text-ink-muted">
          {apiErrorMessage(tokenQuery.error, 'This reset link is invalid or has expired.')}
        </p>
        <RequestNewLink />
        <div className="mt-3">
          <Link to="/auth/login" className={BACK_LINK_CLS}>
            <ArrowLeft className="size-3.5" /> Back to sign in
          </Link>
        </div>
      </div>
    )
  } else if (done) {
    content = (
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50">
          <CheckCircle2 className="size-8 text-emerald-500" />
        </div>
        <h2 className="type-display">Password Updated</h2>
        <p className="mt-2 text-body text-ink-muted">
          Your password has been reset successfully. Redirecting you to sign in…
        </p>
        <Link to="/auth/login" className={cn(buttonVariants({ size: 'lg' }), 'mt-7', SIGN_IN_BUTTON)}>
          Sign in now <ArrowRight className="size-4" />
        </Link>
      </div>
    )
  } else {
    content = (
      <>
        <div className="mb-8 text-center">
          <AuthLogo />
          <h2 className="type-display">Create New Password</h2>
          {tokenQuery.data?.email && (
            <p className="mt-2 text-body text-ink-muted">
              for <span className="font-semibold text-ink">{tokenQuery.data.email}</span>
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* New password */}
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
              <Input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Create a strong password"
                aria-invalid={Boolean(errors.newPassword)}
                aria-describedby={errors.newPassword ? 'pw-error' : undefined}
                {...register('newPassword')}
                className={PASSWORD_INPUT_CLS}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className={REVEAL_BUTTON_CLS}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.newPassword && <p id="pw-error" className="type-error">{errors.newPassword.message}</p>}

            <PasswordStrengthMeter password={passwordValue} />
          </div>

          <PasswordRequirements password={passwordValue} />

          {/* Confirm password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
              <Input
                id="confirm"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Repeat your password"
                aria-invalid={Boolean(errors.confirm)}
                aria-describedby={errors.confirm ? 'confirm-error' : undefined}
                {...register('confirm')}
                className={PASSWORD_INPUT_CLS}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'}
                className={REVEAL_BUTTON_CLS}
              >
                {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.confirm && <p id="confirm-error" className="type-error">{errors.confirm.message}</p>}
          </div>

          {errors.root && (
            <div className="rounded-md border border-red-100 bg-red-50 p-2 type-error">{errors.root.message}</div>
          )}

          <Button type="submit" size="lg" disabled={isSubmitting} className={cn('mt-1', SIGN_IN_BUTTON)}>
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving new password…
              </>
            ) : (
              <>
                Set new password <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/auth/login" className={BACK_LINK_CLS} aria-label="Go back to sign in">
            <ArrowLeft className="size-3.5" />
            Back to sign in
          </Link>
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden md:flex md:flex-row font-sans">
      {/* ── LEFT — Form ── */}
      <AuthPanel>{content}</AuthPanel>
      <AuthHero copy={HERO_COPY} features={HERO_FEATURES} />
    </div>
  )
}
