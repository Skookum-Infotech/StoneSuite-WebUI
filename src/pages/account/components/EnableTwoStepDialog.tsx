import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { authService } from '@/services/authService'
import { useCountdown } from '@/hooks/useCountdown'
import {
  MFA_CODE_LENGTH,
  MFA_ERROR,
  isChallengeDead,
  mfaErrorInfo,
  wrongCodeMessage,
} from '@/lib/mfa'
import { CodeInput } from '@/components/auth/CodeInput'
import { ResendCodeButton } from '@/components/auth/ResendCodeButton'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { MfaCodeSent } from '@/types/auth'
import { TwoStepDialogShell } from './TwoStepDialogShell'

const CONFIRM_FALLBACK = "We couldn't check that code. Please try again."
const RESEND_FALLBACK = "We couldn't send a new code. Please try again."

const codeSchema = z.object({
  code: z.string().length(MFA_CODE_LENGTH, `Enter the ${MFA_CODE_LENGTH}-digit code from your email`),
})
type CodeFields = z.infer<typeof codeSchema>

interface EnableTwoStepDialogProps {
  // The code that was just emailed: where it went and when another may be sent.
  sent: MfaCodeSent
  // Shown above the field when the dialog opens on a code sent a moment ago.
  notice?: string
  onClose: () => void
  onEnabled: () => void
}

// Last step of turning two-step verification on: enter the code emailed to the
// account address. It proves the inbox works before sign-in starts depending
// on it, so a typo'd or dead mailbox can't lock the person out.
export function EnableTwoStepDialog({ sent, notice: openingNotice, onClose, onEnabled }: EnableTwoStepDialogProps) {
  const { secondsLeft, restart } = useCountdown(sent.resendAfterSeconds)
  const [resending, setResending] = useState(false)
  const [notice, setNotice] = useState<string | null>(openingNotice ?? null)
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
      await authService.confirmEnableMfa(code)
      onEnabled()
    } catch (err: unknown) {
      const info = mfaErrorInfo(err, CONFIRM_FALLBACK)
      setError('root', { message: info.code === MFA_ERROR.codeInvalid ? wrongCodeMessage(info) : info.message })
      // A dead code can't be retried, but a new one can be asked for at once:
      // there is no live challenge left to wait out a cooldown on.
      if (isChallengeDead(info.code)) restart(0)
      setValue('code', '')
      setFocus('code')
    }
  }

  const handleResend = async () => {
    setResending(true)
    setNotice(null)
    clearErrors('root')
    try {
      const next = await authService.startEnableMfa()
      restart(next.resendAfterSeconds)
      setValue('code', '')
      setNotice(`A new code is on its way to ${next.maskedEmail}.`)
      setFocus('code')
    } catch (err: unknown) {
      const info = mfaErrorInfo(err, RESEND_FALLBACK)
      if (info.retryAfterSeconds) restart(info.retryAfterSeconds)
      setError('root', { message: info.message })
    } finally {
      setResending(false)
    }
  }

  return (
    <TwoStepDialogShell
      title="Confirm your email"
      description={`We emailed a code to ${sent.maskedEmail}.`}
      busy={isSubmitting}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mfa-enable-code" className="text-xs font-semibold text-stone-500">
            Code from your email
          </Label>
          <Controller
            name="code"
            control={control}
            render={({ field }) => (
              <CodeInput
                id="mfa-enable-code"
                ref={field.ref}
                name={field.name}
                onBlur={field.onBlur}
                value={field.value}
                onValueChange={field.onChange}
                length={sent.codeLength}
                autoFocus
                placeholder="••••••"
                aria-label="Code from your email"
                aria-invalid={Boolean(errors.code)}
                aria-describedby={errors.code ? 'mfa-enable-code-error' : undefined}
              />
            )}
          />
          {errors.code && <p id="mfa-enable-code-error" className="text-xs text-destructive">{errors.code.message}</p>}
        </div>

        {notice && (
          <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs font-medium text-emerald-700">
            {notice}
          </p>
        )}
        {errors.root && (
          <p role="alert" className="rounded-md border border-destructive/15 bg-destructive/5 p-2 text-xs font-medium text-destructive">
            {errors.root.message}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <ResendCodeButton secondsLeft={secondsLeft} pending={resending} onResend={handleResend} />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Cancel turning on two-step verification"
              className="h-9 rounded-lg px-3 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              aria-label="Confirm code and turn on two-step verification"
              className="h-9 rounded-lg bg-brand px-3 text-xs font-semibold text-stone-950 hover:bg-brand-hover"
            >
              {isSubmitting && <Loader2 className="mr-1.5 size-3 animate-spin" aria-hidden="true" />}
              Turn on
            </Button>
          </div>
        </div>
      </form>
    </TwoStepDialogShell>
  )
}
