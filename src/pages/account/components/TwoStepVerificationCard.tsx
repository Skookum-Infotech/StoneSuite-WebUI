import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { authService } from '@/services/authService'
import { MFA_CODE_LENGTH, MFA_ERROR, mfaErrorInfo } from '@/lib/mfa'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { MfaCodeSent } from '@/types/auth'
import { DisableTwoStepDialog } from './DisableTwoStepDialog'
import { EnableTwoStepDialog } from './EnableTwoStepDialog'

const MFA_STATUS_KEY = ['mfa-status'] as const
const START_FALLBACK = "We couldn't send a code right now. Please try again."
const JUST_SENT_NOTICE = 'A code was just sent to you. Check your inbox, or ask for another in a moment.'

type OpenDialog =
  | { kind: 'enable'; sent: MfaCodeSent; notice?: string }
  | { kind: 'disable' }
  | null

// Account Settings > Security. Two-step verification adds an emailed 6-digit
// code after the password at sign-in. Turning it on needs a code from the
// inbox first; turning it off needs the password again.
export function TwoStepVerificationCard() {
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<OpenDialog>(null)
  const status = useQuery({ queryKey: MFA_STATUS_KEY, queryFn: () => authService.getMfaStatus() })

  const startEnable = useMutation({
    mutationFn: () => authService.startEnableMfa(),
    onSuccess: (sent) => setDialog({ kind: 'enable', sent }),
    onError: (err) => {
      // A code from a moment ago is still good: open the dialog on it rather
      // than make the person wait on an error.
      const info = mfaErrorInfo(err, START_FALLBACK)
      if (info.code === MFA_ERROR.resendTooSoon && status.data) {
        setDialog({
          kind: 'enable',
          notice: JUST_SENT_NOTICE,
          sent: {
            success: true,
            maskedEmail: status.data.maskedEmail,
            codeLength: MFA_CODE_LENGTH,
            expiresInSeconds: 0,
            resendAfterSeconds: info.retryAfterSeconds ?? 0,
          },
        })
      }
    },
  })

  const closeDialog = () => {
    setDialog(null)
    startEnable.reset()
  }

  const finish = (message: string) => {
    closeDialog()
    queryClient.invalidateQueries({ queryKey: MFA_STATUS_KEY })
    toast.success(message)
  }

  const startError =
    startEnable.isError && !dialog ? mfaErrorInfo(startEnable.error, START_FALLBACK).message : null

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-100 bg-stone-50/60 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/20 text-brand-dark">
            <ShieldCheck className="size-4.5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-stone-900">Two-Step Verification</h2>
            <p className="mt-0.5 text-xs text-stone-500">Add an emailed code to your sign-in</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-6 sm:py-6">
        {status.isPending ? (
          <div className="flex items-center gap-2 py-4 text-xs text-stone-500">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading…
          </div>
        ) : status.isError ? (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3.5">
            <p className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              We couldn&apos;t load your two-step verification setting.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => status.refetch()}
              aria-label="Try loading two-step verification again"
              className="h-8 rounded-lg px-3 text-xs"
            >
              Try again
            </Button>
          </div>
        ) : !status.data.available ? (
          <p className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3.5 text-xs text-stone-600">
            Your account signs in through your organization&apos;s single sign-on, which handles extra
            verification itself. There&apos;s nothing to turn on here.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p id="two-step-label" className="text-xs font-bold text-stone-900">Email code at sign-in</p>
                <p id="two-step-hint" className="mt-1 text-xs text-stone-500">
                  {status.data.enabled
                    ? `After your password, we email a ${MFA_CODE_LENGTH}-digit code to ${status.data.maskedEmail}.`
                    : `Turn it on and signing in will also need a ${MFA_CODE_LENGTH}-digit code we email to ${status.data.maskedEmail}.`}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {startEnable.isPending && <Loader2 className="size-4 animate-spin text-stone-400" aria-hidden="true" />}
                {/* Controlled by the saved setting: it flips only once the code
                    (to turn on) or password (to turn off) has been accepted. */}
                <Switch
                  checked={status.data.enabled}
                  disabled={startEnable.isPending}
                  onCheckedChange={(next) => (next ? startEnable.mutate() : setDialog({ kind: 'disable' }))}
                  aria-labelledby="two-step-label"
                  aria-describedby="two-step-hint"
                />
              </div>
            </div>

            {startError && (
              <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-destructive">
                <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                {startError}
              </p>
            )}
          </div>
        )}
      </div>

      {dialog?.kind === 'enable' && (
        <EnableTwoStepDialog
          sent={dialog.sent}
          notice={dialog.notice}
          onClose={closeDialog}
          onEnabled={() => finish('Two-step verification is on')}
        />
      )}
      {dialog?.kind === 'disable' && (
        <DisableTwoStepDialog onClose={closeDialog} onDisabled={() => finish('Two-step verification is off')} />
      )}
    </div>
  )
}
