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

import { SIGN_IN_BUTTON } from './authStyles'
import { cn } from '@/lib/utils'
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
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">
          Email
        </Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <Input
            id="email"
            type="email"
            autoFocus
            autoComplete="email"
            placeholder="name@company.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
            className="auth-field h-12 rounded-xl border-stone-200 bg-white pl-11 transition-colors duration-150"
          />
        </div>
        {errors.email && <p id="email-error" className="type-error">{errors.email.message}</p>}
      </div>

      {errors.root && (
        <div className="rounded-md border border-destructive/15 bg-destructive/5 p-2 type-error">
          {errors.root.message}
        </div>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        aria-label="Sign in"
        size="lg"
        className={cn('mt-1', SIGN_IN_BUTTON)}
      >
        {isSubmitting ? (
          <><Loader2 className="size-4 animate-spin" />Checking...</>
        ) : (
          <>Sign In<ArrowRight className="size-4" /></>
        )}
      </Button>
    </form>
  )
}
