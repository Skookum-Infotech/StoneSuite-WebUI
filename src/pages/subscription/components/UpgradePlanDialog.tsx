import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { newFeatures } from '@/lib/subscriptionForm'
import { SubscriptionDialogShell } from './SubscriptionDialogShell'
import type { PlanTier } from '@/types/subscription'

interface UpgradeContext {
  currentTier: PlanTier
  targetTier: PlanTier
  billingCycle: 'monthly' | 'yearly'
  renewalDate: string
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

export function UpgradePlanDialog({
  plan,
  onClose,
  onConfirm,
}: {
  plan: UpgradeContext
  onClose: () => void
  onConfirm: (targetTierId: PlanTier['id']) => void
}) {
  const { currentTier, targetTier, billingCycle, renewalDate } = plan
  const price = billingCycle === 'monthly' ? targetTier.pricePerMonth : targetTier.pricePerYear
  const period = billingCycle === 'monthly' ? '/mo' : '/yr'
  const added = newFeatures(currentTier, targetTier)

  return (
    <SubscriptionDialogShell
      header={{ title: `Upgrade to ${targetTier.name}`, icon: Sparkles }}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
          <span className="text-xs font-semibold text-ink-muted">{currentTier.name}</span>
          <ArrowRight className="size-3.5 text-ink-faint shrink-0" aria-hidden="true" />
          <span className="text-xs font-bold text-ink-strong">{targetTier.name}</span>
          <span className="ml-auto text-sm font-bold text-ink-strong tabular-nums">
            {price === null ? 'Custom' : `$${price}${period}`}
          </span>
        </div>

        <p className="type-helper">
          Effective immediately · renews {fmtDate(renewalDate)}
        </p>

        {added.length > 0 && (
          <div>
            <p className="mb-2 type-overline">What&apos;s new</p>
            <ul className="space-y-1.5">
              {added.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand/20 text-link">
                    <Check className="size-2.5" strokeWidth={3} aria-hidden="true" />
                  </div>
                  <span className="text-xs text-ink">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-5">
        <button
          type="button"
          onClick={onClose}
          className={buttonVariants({ variant: 'outline' })}
          aria-label="Cancel upgrade"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(targetTier.id)}
          className={cn(buttonVariants({ size: 'lg' }), 'active:scale-[0.99]')}
          aria-label={`Confirm upgrade to ${targetTier.name}`}
        >
          Confirm Upgrade
        </button>
      </div>
    </SubscriptionDialogShell>
  )
}
