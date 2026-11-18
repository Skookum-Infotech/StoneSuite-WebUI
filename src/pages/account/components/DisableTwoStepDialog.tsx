import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { authService } from '@/services/authService'
import { MFA_ERROR, mfaErrorInfo } from '@/lib/mfa'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { TwoStepDialogShell } from './TwoStepDialogShell'

const DISABLE_FALLBACK = "We couldn't turn off two-step verification. Please try again."

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
})
type PasswordFields = z.infer<typeof passwordSchema>

interface DisableTwoStepDialogProps {
  onClose: () => void
  onDisabled: () => void
}

// Turning two-step verification off asks for the password again, so a session
// left open on a shared computer can't quietly drop the second step.
export function DisableTwoStepDialog({ onClose, onDisabled }: DisableTwoStepDialogProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFields>({ resolver: zodResolver(passwordSchema) })

  const onSubmit = async ({ currentPassword }: PasswordFields) => {
    try {
      await authService.disableMfa(currentPassword)
      onDisabled()
    } catch (err: unknown) {
      const info = mfaErrorInfo(err, DISABLE_FALLBACK)
      if (info.code === MFA_ERROR.invalidPassword) {
        setError('currentPassword', { message: info.message })
      } else {
        setError('root', { message: info.message })
      }
    }
  }

  return (
    <TwoStepDialogShell
      title="Turn off two-step verification?"
      description="You'll sign in with just your password."
      busy={isSubmitting}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mfa-disable-password" className="text-xs font-semibold text-ink-muted">
            Current password
          </Label>
          <PasswordInput
            id="mfa-disable-password"
            autoComplete="current-password"
            aria-label="Current password"
            toggleLabel="current password"
            aria-invalid={Boolean(errors.currentPassword)}
            aria-describedby={errors.currentPassword ? 'mfa-disable-password-error' : undefined}
            className="h-11 rounded-xl border-stone-200"
            {...register('currentPassword')}
          />
          {errors.currentPassword && (
            <p id="mfa-disable-password-error" className="type-error">{errors.currentPassword.message}</p>
          )}
        </div>

        {errors.root && (
          <p role="alert" className="rounded-md border border-destructive/15 bg-destructive/5 p-2 type-error">
            {errors.root.message}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Keep two-step verification on"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            aria-label="Confirm password and turn off two-step verification"
            variant="destructive"
          >
            {isSubmitting && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
            Turn off
          </Button>
        </div>
      </form>
    </TwoStepDialogShell>
  )
}
