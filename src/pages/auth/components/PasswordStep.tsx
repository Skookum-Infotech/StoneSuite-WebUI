import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight, Eye, EyeOff, Lock, Loader2, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import { authService } from '@/services/authService'
import { apiErrorMessage } from '@/api/tenantClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AuthResponse } from '@/types/auth'

const passwordSchema = z.object({
  password: z.string().min(1, 'Password is required'),
})
type PasswordFields = z.infer<typeof passwordSchema>

interface PasswordStepProps {
  email: string
  // May return a promise (post-login enrichment + navigation) -- awaited
  // below so the button's loading state covers the whole handoff, not just
  // the login call itself.
  onSuccess: (response: AuthResponse) => void | Promise<void>
  onBack: () => void
}

// Second step, shown once EmailStep resolves an email to "password". The
// email itself is display-only here -- changing it means going back to
// re-identify, since a different email could resolve to SSO instead.
export function PasswordStep({ email, onSuccess, onBack }: PasswordStepProps) {
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFields>({ resolver: zodResolver(passwordSchema) })

  const onSubmit = async (data: PasswordFields) => {
    try {
      const response = await authService.login({ email, password: data.password, rememberMe: false })
      if (response.success && response.user && response.token && response.expiresAt) {
        await onSuccess(response)
      } else {
        setError('root', { message: response.message ?? 'Login failed' })
      }
    } catch (err: unknown) {
      setError('root', { message: apiErrorMessage(err, 'An error occurred during login') })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div className="flex items-center gap-2.5 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
        <Mail className="size-4 shrink-0 text-stone-400" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-700">{email}</span>
        <button
          type="button"
          onClick={onBack}
          aria-label="Use a different email"
          className="shrink-0 text-xs font-semibold text-stone-400 underline underline-offset-2 transition-colors hover:text-stone-700"
        >
          Change
        </button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-2xs font-bold uppercase tracking-[0.2em] text-stone-400">
          Password
        </Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-stone-300" />
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoFocus
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...register('password')}
            className="h-12 rounded-xl border-stone-200 bg-white pl-11 pr-11 text-sm text-stone-950 placeholder:text-stone-300 transition-colors duration-150"
            style={{ '--tw-ring-color': 'rgba(0,95,115,0.15)' } as React.CSSProperties}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-400 transition-colors hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/30"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <div className="flex justify-end">
          <Link
            to="/auth/forgot-password"
            className="text-xs font-medium transition-colors duration-150 hover:opacity-100"
            style={{ color: 'rgba(0,95,115,0.55)' }}
          >
            Forgot password?
          </Link>
        </div>
        {errors.password && <p id="password-error" className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      {errors.root && (
        <div className="text-sm font-medium text-destructive bg-destructive/5 p-2 rounded-md border border-destructive/15">
          {errors.root.message}
        </div>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        aria-label="Sign in"
        className="mt-1 h-12 w-full rounded-xl bg-brand text-sm font-semibold text-stone-950 transition-all duration-200 hover:bg-brand-hover active:scale-[0.99] focus-visible:ring-stone-400/30 disabled:opacity-70 disabled:cursor-not-allowed"
        style={{ boxShadow: '0 4px 16px rgba(163,230,53,0.28)' }}
      >
        {isSubmitting ? (
          <><Loader2 className="mr-2 size-4 animate-spin" />Signing in...</>
        ) : (
          <>Sign In<ArrowRight className="ml-2 size-4" /></>
        )}
      </Button>
    </form>
  )
}
