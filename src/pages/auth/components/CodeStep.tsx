import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight, Loader2, Mail } from 'lucide-react'
import { authService } from '@/services/authService'
import { useCountdown } from '@/hooks/useCountdown'
import {
  MFA_CODE_LENGTH,
  MFA_ERROR,
  isChallengeDead,
  mfaErrorInfo,
  wrongCodeMessage,
} from '@/lib/mfa'
import { activeSessionPrompt } from '@/lib/singleSession'
import { CodeInput } from '@/components/auth/CodeInput'
import { ResendCodeButton } from '@/components/auth/ResendCodeButton'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { ActiveSessionPrompt, AuthResponse, MfaChallenge } from '@/types/auth'

import { SIGN_IN_BUTTON } from './authStyles'
import { cn } from '@/lib/utils'
const SECONDS_PER_MINUTE = 60
const VERIFY_FALLBACK = "We couldn't check that code. Please try again."
const RESEND_FALLBACK = "We couldn't send a new code. Please try again."

const codeSchema = z.object({
  code: z.string().length(MFA_CODE_LENGTH, `Enter the ${MFA_CODE_LENGTH}-digit code from your email`),
})
type CodeFields = z.infer<typeof codeSchema>

interface CodeStepProps {
  challenge: MfaChallenge
  // Same hand-off as PasswordStep's: awaited so the button's loading state
  // covers the post-login work, not just the verify call.
  onSuccess: (response: AuthResponse) => void | Promise<void>
  // Back to the password step. A new code then needs a new password entry.
  onBack: () => void
  // The code was right but the account is in use on another browser.
  onActiveSession: (prompt: ActiveSessionPrompt) => void
}

// Third sign-in step, shown when the password was right but the account has
// two-step verification on. The session starts only once the emailed code is
// accepted here -- until then the browser holds nothing but the challenge token.
export function CodeStep({ challenge, onSuccess, onBack, onActiveSession }: CodeStepProps) {
  const { secondsLeft, restart } = useCountdown(challenge.resendAfterSeconds)
  const [resending, setResending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  // Set once the challenge is gone for good (used, timed out, or too many wrong
  // codes): typing again can't work, so the form gives way to "Sign in again".
  const [deadMessage, setDeadMessage] = useState<string | null>(null)
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<CodeFields>({ resolver: zodResolver(codeSchema), defaultValues: { code: '' } })

  const onSubmit = async ({ code }: CodeFields) => {
    setNotice(null)
    try {
      const response = await authService.verifyMfa(challenge.challengeToken, code)
      if (response.success && response.user && response.token && response.expiresAt) {
        await onSuccess(response)
      } else {
        setError('root', { message: response.message ?? 'Login failed' })
      }
    } catch (err: unknown) {
      const prompt = activeSessionPrompt(err)
      if (prompt) {
        onActiveSession(prompt)
        return
      }
      const info = mfaErrorInfo(err, VERIFY_FALLBACK)
      if (isChallengeDead(info.code)) {
        setDeadMessage(info.message)
        return
      }
      setError('root', { message: info.code === MFA_ERROR.codeInvalid ? wrongCodeMessage(info) : info.message })
      setValue('code', '')
      setFocus('code')
    }
  }

  const handleResend = async () => {
    setResending(true)
    setNotice(null)
    clearErrors('root')
    try {
      const sent = await authService.resendMfa(challenge.challengeToken)
      restart(sent.resendAfterSeconds)
      setValue('code', '')
      setNotice(`A new code is on its way to ${sent.maskedEmail}.`)
      setFocus('code')
    } catch (err: unknown) {
      const info = mfaErrorInfo(err, RESEND_FALLBACK)
      if (isChallengeDead(info.code)) {
        setDeadMessage(info.message)
      } else {
        // The server's wait is the truth: a click that beat our countdown
        // restarts it from what the server says is left.
        if (info.retryAfterSeconds) restart(info.retryAfterSeconds)
        setError('root', { message: info.message })
      }
    } finally {
      setResending(false)
    }
  }

  if (deadMessage) {
    return (
      <div className="space-y-5">
        <div role="alert" className="rounded-md border border-destructive/15 bg-destructive/5 p-2 type-error">
          {deadMessage}
        </div>
        <Button
          type="button"
          onClick={onBack}
          aria-label="Sign in again"
          size="lg"
        className={cn(SIGN_IN_BUTTON)}
        >
          Sign in again
        </Button>
      </div>
    )
  }

  const expiresInMinutes = Math.round(challenge.expiresInSeconds / SECONDS_PER_MINUTE)

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div className="flex items-center gap-2.5 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
        <Mail className="size-4 shrink-0 text-stone-400" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-body font-medium text-ink">
          Code sent to {challenge.maskedEmail}
        </span>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to password"
          className="shrink-0 text-caption font-semibold text-ink-muted underline underline-offset-2 transition-colors hover:text-ink-strong"
        >
          Back
        </button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mfa-code">
          Sign-in code
        </Label>
        <Controller
          name="code"
          control={control}
          render={({ field }) => (
            <CodeInput
              id="mfa-code"
              ref={field.ref}
              name={field.name}
              onBlur={field.onBlur}
              value={field.value}
              onValueChange={field.onChange}
              length={challenge.codeLength}
              autoFocus
              placeholder="••••••"
              aria-label="Sign-in code"
              aria-invalid={Boolean(errors.code)}
              aria-describedby={errors.code ? 'mfa-code-error' : 'mfa-code-hint'}
            />
          )}
        />
        {errors.code ? (
          <p id="mfa-code-error" className="type-error">{errors.code.message}</p>
        ) : (
          expiresInMinutes > 0 && (
            <p id="mfa-code-hint" className="type-helper">
              The code works for {expiresInMinutes} {expiresInMinutes === 1 ? 'minute' : 'minutes'}.
            </p>
          )
        )}
      </div>

      {notice && (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-caption font-medium text-success-ink">
          {notice}
        </p>
      )}

      {errors.root && (
        <div role="alert" className="rounded-md border border-destructive/15 bg-destructive/5 p-2 type-error">
          {errors.root.message}
        </div>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        aria-label="Verify code"
        size="lg"
        className={cn('mt-1', SIGN_IN_BUTTON)}
      >
        {isSubmitting ? (
          <><Loader2 className="size-4 animate-spin" />Verifying...</>
        ) : (
          <>Verify and sign in<ArrowRight className="size-4" /></>
        )}
      </Button>

      <div className="flex items-center justify-center gap-1.5 type-helper">
        <span>Didn&apos;t get it?</span>
        <ResendCodeButton secondsLeft={secondsLeft} pending={resending} onResend={handleResend} />
      </div>
    </form>
  )
}
