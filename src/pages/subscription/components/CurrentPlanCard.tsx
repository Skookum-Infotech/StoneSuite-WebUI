import { buttonVariants } from '@/components/ui/button';
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CurrentPlan, SubscriptionStatus } from '@/types/subscription'

const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; dot: string; text: string }> = {
  active:    { label: 'Active',    dot: 'bg-emerald-500', text: 'text-emerald-700' },
  trialing:  { label: 'Trial',     dot: 'bg-blue-500',    text: 'text-blue-700'    },
  past_due:  { label: 'Past Due',  dot: 'bg-amber-400',   text: 'text-amber-700'   },
  canceled:  { label: 'Canceled',  dot: 'bg-stone-400',   text: 'text-ink-muted'   },
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
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/20 text-link">
            <Sparkles className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="type-dialog-title">{plan.tier.name} Plan</h2>
              <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 type-pill', cfg.text)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                {cfg.label}
              </span>
            </div>
            <p className="mt-1 type-helper">
              {isEnterprise ? 'Custom pricing' : `$${plan.tier.pricePerMonth}/mo`}
              <span className="mx-1.5 text-ink-muted">•</span>
              Renews {fmtDate(plan.renewalDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 shrink-0 self-end sm:self-auto">
          <button
            onClick={onCancel}
            className="text-xs font-semibold text-ink-muted hover:text-ink transition-colors cursor-pointer"
            aria-label="Cancel subscription"
          >
            Cancel
          </button>
          <button
            onClick={onUpgrade}
            className={cn(buttonVariants({ size: 'lg' }), 'active:scale-[0.99]')}
            aria-label="Upgrade plan"
          >
            Upgrade Plan
          </button>
        </div>
      </div>
    </div>
  )
}
