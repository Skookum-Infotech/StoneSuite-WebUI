import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PlanTier } from '@/types/subscription'

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
        <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-1 text-2xs font-bold text-stone-950">
          Current Plan
        </span>
      ) : tier.highlighted ? (
        <span className="absolute -top-3 left-6 rounded-full bg-[#001219] px-3 py-1 text-2xs font-bold text-brand">
          Most Popular
        </span>
      ) : null}

      <h3 className="text-sm font-bold text-stone-900">{tier.name}</h3>
      <div className="mt-2 flex items-baseline gap-1">
        {price === null ? (
          <span className="text-2xl font-bold text-stone-900">Custom</span>
        ) : (
          <>
            <span className="text-3xl font-bold tracking-tight text-stone-900">${price}</span>
            <span className="text-xs font-semibold text-stone-400">{period}</span>
          </>
        )}
      </div>

      <ul className="mt-4 flex-1 space-y-2">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand/20 text-brand-dark">
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
          'mt-5 w-full rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed',
          isCurrent
            ? 'bg-stone-100 text-stone-400'
            : 'bg-brand text-stone-950 hover:bg-brand-hover active:scale-[0.99]',
        )}
        style={!isCurrent ? { boxShadow: '0 4px 14px rgba(194,245,137,0.35)' } : undefined}
        aria-label={`${ACTION_LABEL[action]} — ${tier.name}`}
      >
        {ACTION_LABEL[action]}
      </button>
    </div>
  )
}
