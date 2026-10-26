import { Loader2 } from 'lucide-react'

interface ResendCodeButtonProps {
  // Seconds until the server will accept another send; 0 means now.
  secondsLeft: number
  pending: boolean
  onResend: () => void
}

// "Resend code", greyed out with a countdown while the server's cooldown runs.
export function ResendCodeButton({ secondsLeft, pending, onResend }: ResendCodeButtonProps) {
  const waiting = secondsLeft > 0
  return (
    <button
      type="button"
      onClick={onResend}
      disabled={waiting || pending}
      aria-label={waiting ? `Resend code in ${secondsLeft} seconds` : 'Resend code'}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 underline underline-offset-2 transition-colors hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/30 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
    >
      {pending && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
      {waiting ? `Resend code in ${secondsLeft}s` : 'Resend code'}
    </button>
  )
}
