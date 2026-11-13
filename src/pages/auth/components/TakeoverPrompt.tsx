import { useState } from 'react'
import { AlertTriangle, ArrowRight, Loader2, MonitorSmartphone } from 'lucide-react'
import { isAxiosError } from 'axios'
import { authService } from '@/services/authService'
import { apiErrorMessage } from '@/api/tenantClient'
import { TAKEOVER_EXPIRED_CODE, TAKEOVER_REFUSED_CODES, lastActiveLabel } from '@/lib/singleSession'
import { Button } from '@/components/ui/button'
import type { ActiveSessionPrompt, AuthResponse } from '@/types/auth'

const TAKEOVER_FALLBACK = "We couldn't sign you in here. Please try again."

interface TakeoverPromptProps {
  prompt: ActiveSessionPrompt
  // Same hand-off as PasswordStep's: awaited so the button's loading state
  // covers the post-login work.
  onSuccess: (response: AuthResponse) => void | Promise<void>
  // Keeps the other session and leaves this browser signed out.
  onCancel: () => void
}

/** True when confirming can no longer work: the prompt expired, or moving the
 *  sign-in was refused by the workspace's wait/daily limit. */
function isTakeoverFinal(err: unknown): boolean {
  if (!isAxiosError(err)) return false
  const code = (err.response?.data as { code?: unknown } | undefined)?.code
  return code === TAKEOVER_EXPIRED_CODE || (typeof code === 'string' && TAKEOVER_REFUSED_CODES.includes(code))
}

// Shown instead of signing in when the account is already in use on another
// browser: each licence is for one person, so continuing here ends that
// session (it gets a 30-second warning first).
export function TakeoverPrompt({ prompt, onSuccess, onCancel }: TakeoverPromptProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  // Read once: the label is a snapshot of when the prompt appeared.
  const [shownAt] = useState(() => Date.now())

  const handleContinue = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const response = await authService.takeoverSession()
      if (response.success && response.user && response.token && response.expiresAt) {
        await onSuccess(response)
      } else {
        setError(response.message ?? TAKEOVER_FALLBACK)
      }
    } catch (err: unknown) {
      if (isTakeoverFinal(err)) setExpired(true)
      setError(apiErrorMessage(err, TAKEOVER_FALLBACK))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5" role="region" aria-labelledby="takeover-title">
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <MonitorSmartphone className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
        <div className="min-w-0 text-sm text-amber-900">
          <p id="takeover-title" className="font-semibold">You&apos;re already signed in on another device</p>
          <p className="mt-1 text-xs text-amber-800">
            {prompt.deviceLabel}, active {lastActiveLabel(prompt.lastSeenAt, shownAt)}. Your account can be
            signed in on only one browser at a time. End that session and continue here?
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/15 bg-destructive/5 p-2 text-sm font-medium text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        {!expired && (
          <Button
            type="button"
            onClick={handleContinue}
            disabled={submitting}
            aria-label="End the other session and continue here"
            className="h-12 flex-1 rounded-xl bg-brand text-sm font-semibold text-stone-950 hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? (
              <><Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />Signing in...</>
            ) : (
              <>Continue here<ArrowRight className="ml-2 size-4" aria-hidden="true" /></>
            )}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={submitting}
          aria-label={expired ? 'Sign in again' : 'Cancel and keep the other session'}
          className="h-12 flex-1 rounded-xl text-sm font-semibold"
        >
          {expired ? 'Sign in again' : 'Cancel'}
        </Button>
      </div>
    </div>
  )
}
