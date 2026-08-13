import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight, Loader2, Mail } from 'lucide-react'
import { authService } from '@/services/authService'
import { apiErrorMessage } from '@/api/tenantClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { IdentifyResult } from '@/types/auth'

const emailSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
})
type EmailFields = z.infer<typeof emailSchema>

interface EmailStepProps {
  defaultEmail: string
  onIdentified: (email: string, result: IdentifyResult) => void
}

// Login page's entry step: a single email field. Submitting resolves the
// email via POST /auth/identify, which the caller uses to decide whether to
// show the password step or redirect to an identity provider -- this
// component only collects the email and reports what the backend said.
export function EmailStep({ defaultEmail, onIdentified }: EmailStepProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EmailFields>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: defaultEmail },
  })

  const identify = useMutation({
    mutationFn: (email: string) => authService.identify(email),
  })

  const onSubmit = async (data: EmailFields) => {
    let result: IdentifyResult
    try {
      result = await identify.mutateAsync(data.email)
    } catch (err: unknown) {
      setError('root', { message: apiErrorMessage(err, "Couldn't verify that email. Try again.") })
      return
    }
    onIdentified(data.email, result)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-2xs font-bold uppercase tracking-[0.2em] text-stone-400">
          Email
        </Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-300" />
          <Input
            id="email"
            type="email"
            autoFocus
            autoComplete="email"
            placeholder="name@company.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
            className="h-11 rounded-xl border-stone-200 bg-white pl-10 text-stone-950 placeholder:text-stone-300 transition-colors duration-150"
            style={{ '--tw-ring-color': 'rgba(0,95,115,0.15)' } as React.CSSProperties}
          />
        </div>
        {errors.email && <p id="email-error" className="text-xs text-destructive">{errors.email.message}</p>}
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
        className="mt-1 h-11 w-full rounded-xl bg-brand text-sm font-semibold text-stone-950 transition-all duration-200 hover:bg-brand-hover active:scale-[0.99] focus-visible:ring-stone-400/30 disabled:opacity-70 disabled:cursor-not-allowed"
        style={{ boxShadow: '0 4px 16px rgba(163,230,53,0.28)' }}
      >
        {isSubmitting ? (
          <><Loader2 className="mr-2 size-4 animate-spin" />Checking...</>
        ) : (
          <>Sign In<ArrowRight className="ml-2 size-4" /></>
        )}
      </Button>
    </form>
  )
}
