import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CurrentPlan, SubscriptionStatus } from '@/types/subscription'

const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; dot: string; text: string }> = {
  active:    { label: 'Active',    dot: 'bg-emerald-500', text: 'text-emerald-700' },
  trialing:  { label: 'Trial',     dot: 'bg-blue-500',    text: 'text-blue-700'    },
  past_due:  { label: 'Past Due',  dot: 'bg-amber-400',   text: 'text-amber-700'   },
  canceled:  { label: 'Canceled',  dot: 'bg-stone-400',   text: 'text-stone-500'   },
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

interface CurrentPlanCardProps {
  plan: CurrentPlan
  onUpgrade: () => void
  onCancel: () => void
}

export function CurrentPlanCard({ plan, onUpgrade, onCancel }: CurrentPlanCardProps) {
  const cfg = STATUS_CONFIG[plan.status]
  const isEnterprise = plan.tier.pricePerMonth === null

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-col gap-3 p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/20 text-brand-dark">
            <Sparkles className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-bold text-stone-900">{plan.tier.name} Plan</h2>
              <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-2xs font-bold', cfg.text)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                {cfg.label}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              {isEnterprise ? 'Custom pricing' : `$${plan.tier.pricePerMonth}/mo`}
              <span className="mx-1.5 text-stone-300">•</span>
              Renews {fmtDate(plan.renewalDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 shrink-0 self-end sm:self-auto">
          <button
            onClick={onCancel}
            className="text-xs font-semibold text-stone-500 hover:text-stone-700 transition-colors cursor-pointer"
            aria-label="Cancel subscription"
          >
            Cancel
          </button>
          <button
            onClick={onUpgrade}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-stone-950 hover:bg-brand-hover active:scale-[0.99] transition-all cursor-pointer"
            style={{ boxShadow: '0 4px 14px rgba(194,245,137,0.35)' }}
            aria-label="Upgrade plan"
          >
            Upgrade Plan
          </button>
        </div>
      </div>
    </div>
  )
}
