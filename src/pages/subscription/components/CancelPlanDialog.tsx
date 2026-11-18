import { buttonVariants } from '@/components/ui/button';
import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cancelReasonOptions } from '@/lib/subscriptionForm'
import { SubscriptionDialogShell } from './SubscriptionDialogShell'
import type { CurrentPlan, CancelReason } from '@/types/subscription'

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

export function CancelPlanDialog({
  plan,
  onClose,
  onConfirm,
}: {
  plan: CurrentPlan
  onClose: () => void
  onConfirm: (reason: CancelReason | null) => void
}) {
  const [reason, setReason] = useState<CancelReason | null>(null)

  return (
    <SubscriptionDialogShell
      header={{
        title: `Cancel your ${plan.tier.name} plan?`,
        description: `You'll lose access to ${plan.tier.features.length} features and your workspace will move to the free tier after ${fmtDate(plan.renewalDate)}.`,
        icon: AlertTriangle,
        tone: 'destructive',
      }}
      onClose={onClose}
    >
      <fieldset className="space-y-1.5">
        <legend className="type-overline mb-1.5">
          Why are you cancelling? (optional)
        </legend>
        {cancelReasonOptions.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 cursor-pointer transition-colors type-field-label',
              reason === opt.value ? 'border-brand bg-brand/5 text-ink-strong font-semibold' : 'border-stone-200 text-ink hover:bg-stone-50',
            )}
          >
            <input
              type="radio"
              name="cancel-reason"
              value={opt.value}
              checked={reason === opt.value}
              onChange={() => setReason(opt.value)}
              className="accent-brand"
            />
            {opt.label}
          </label>
        ))}
      </fieldset>

      {reason === 'too_expensive' && (
        <p className="mt-3 rounded-xl bg-stone-50 border border-stone-200 px-3.5 py-2.5 type-helper">
          Consider downgrading instead? You can switch to a lower-cost plan from the Plan tab.
        </p>
      )}

      <div className="flex justify-end gap-2 mt-5">
        <button
          type="button"
          onClick={onClose}
          className={buttonVariants({ variant: 'outline' })}
          aria-label="Keep current plan"
        >
          Keep Plan
        </button>
        <button
          type="button"
          onClick={() => onConfirm(reason)}
          className={cn(buttonVariants({ variant: 'destructive' }), 'active:scale-[0.99]')}
          aria-label="Confirm plan cancellation"
        >
          Confirm Cancellation
        </button>
      </div>
    </SubscriptionDialogShell>
  )
}
