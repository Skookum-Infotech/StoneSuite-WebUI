import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Loader2, Mail } from 'lucide-react'
import { samlAuthService } from '@/services/samlAuthService'
import { apiErrorMessage } from '@/api/tenantClient'
import { SSO_PROVIDER_LABELS } from '@/lib/ssoConfigForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SAMLProvider } from '@/types/tenant'

const emailSchema = z.object({
  email: z.string().min(1, 'Work email is required').email('Enter a valid email'),
})
type EmailFields = z.infer<typeof emailSchema>

interface SsoEmailStepProps {
  provider: SAMLProvider
  defaultEmail: string
  onResolved: (tenantId: string, provider: SAMLProvider) => void
  onBack: () => void
}

// Home-realm discovery step: the user already picked a provider button, this
// collects their work email and asks the backend which tenant + provider it
// belongs to. If the domain is registered under a *different* provider than
// the one clicked, we surface that instead of silently redirecting them
// somewhere they didn't choose.
export function SsoEmailStep({ provider, defaultEmail, onResolved, onBack }: SsoEmailStepProps) {
  const [mismatch, setMismatch] = useState<{ tenantId: string; provider: SAMLProvider } | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EmailFields>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: defaultEmail },
  })

  const discover = useMutation({
    mutationFn: (email: string) => samlAuthService.discover(email),
  })

  const onSubmit = async (data: EmailFields) => {
    setMismatch(null)
    let result
    try {
      result = await discover.mutateAsync(data.email)
    } catch (err: unknown) {
      setError('root', { message: apiErrorMessage(err, "Couldn't verify that email. Try again.") })
      return
    }
    if (!result.found || !result.provider || !result.tenantId) {
      setError('email', { message: 'No SSO connection found for that email address.' })
      return
    }
    if (result.provider !== provider) {
      setMismatch({ tenantId: result.tenantId, provider: result.provider })
      return
    }
    onResolved(result.tenantId, result.provider)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="w-full space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="sso-email" className="text-2xs font-bold uppercase tracking-[0.2em] text-stone-400">
          Work email
        </Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-300" />
          <Input
            id="sso-email"
            type="email"
            autoFocus
            autoComplete="email"
            placeholder="name@company.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'sso-email-error' : undefined}
            {...register('email')}
            className="h-11 rounded-xl border-stone-200 bg-white pl-10 text-stone-950 placeholder:text-stone-300 transition-colors duration-150"
          />
        </div>
        {errors.email && (
          <p id="sso-email-error" className="text-xs text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      {mismatch && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <p>
            That email signs in with{' '}
            <strong className="font-semibold">{SSO_PROVIDER_LABELS[mismatch.provider]}</strong>, not{' '}
            {SSO_PROVIDER_LABELS[provider]}.
          </p>
          <button
            type="button"
            onClick={() => onResolved(mismatch.tenantId, mismatch.provider)}
            aria-label={`Continue signing in with ${SSO_PROVIDER_LABELS[mismatch.provider]}`}
            className="mt-2 inline-flex items-center gap-1 font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950"
          >
            Continue with {SSO_PROVIDER_LABELS[mismatch.provider]}
            <ArrowRight className="size-3" />
          </button>
        </div>
      )}

      {errors.root && (
        <div className="text-sm font-medium text-destructive bg-destructive/5 p-2 rounded-md border border-destructive/15">
          {errors.root.message}
        </div>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        aria-label={`Continue signing in with ${SSO_PROVIDER_LABELS[provider]}`}
        className="h-11 w-full rounded-xl bg-brand text-sm font-semibold text-stone-950 transition-all duration-200 hover:bg-brand-hover active:scale-[0.99] focus-visible:ring-stone-400/30 disabled:opacity-70 disabled:cursor-not-allowed"
        style={{ boxShadow: '0 4px 16px rgba(163,230,53,0.28)' }}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Continuing…
          </>
        ) : (
          <>Continue</>
        )}
      </Button>

      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to sign-in options"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
        >
          <ArrowLeft className="size-3.5" />
          Back to sign-in options
        </button>
      </div>
    </form>
  )
}
