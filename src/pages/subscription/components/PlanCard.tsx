import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PlanTier } from '@/types/subscription'

import { buttonVariants } from '@/components/ui/button'
export type PlanAction = 'current' | 'upgrade' | 'downgrade' | 'contact'

const ACTION_LABEL: Record<PlanAction, string> = {
  current: 'Current Plan',
  upgrade: 'Upgrade',
  downgrade: 'Downgrade',
  contact: 'Contact Sales',
}

interface PlanCardProps {
  tier: PlanTier
  billingCycle: 'monthly' | 'yearly'
  action: PlanAction
  onSelect: (id: PlanTier['id']) => void
}

export function PlanCard({ tier, billingCycle, action, onSelect }: PlanCardProps) {
  const isCurrent = action === 'current'
  const price = billingCycle === 'monthly' ? tier.pricePerMonth : tier.pricePerYear
  const period = billingCycle === 'monthly' ? '/mo' : '/yr'

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition-all',
        (tier.highlighted || isCurrent) ? 'border-brand ring-2 ring-brand/30' : 'border-stone-200',
      )}
    >
      {isCurrent ? (
        <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-1 text-stone-950 type-pill">
          Current Plan
        </span>
      ) : tier.highlighted ? (
        <span className="absolute -top-3 left-6 rounded-full bg-[#001219] px-3 py-1 text-brand type-pill">
          Most Popular
        </span>
      ) : null}

      <h3 className="type-card-title">{tier.name}</h3>
      <div className="mt-2 flex items-baseline gap-1">
        {price === null ? (
          <span className="text-2xl font-bold text-stone-900">Custom</span>
        ) : (
          <>
            <span className="text-3xl font-bold tracking-tight text-stone-900">${price}</span>
            <span className="text-xs font-semibold text-stone-500">{period}</span>
          </>
        )}
      </div>

      <ul className="mt-4 flex-1 space-y-2">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand/20 text-link">
              <Check className="size-2.5" strokeWidth={3} />
            </div>
            <span className="text-xs text-stone-600">{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(tier.id)}
        disabled={isCurrent}
        className={cn(
          buttonVariants({ size: 'lg' }),
          'mt-5 w-full disabled:opacity-100',
          isCurrent ? 'bg-stone-100 text-ink-muted' : 'active:scale-[0.99]',
        )}
        aria-label={`${ACTION_LABEL[action]} — ${tier.name}`}
      >
        {ACTION_LABEL[action]}
      </button>
    </div>
  )
}
