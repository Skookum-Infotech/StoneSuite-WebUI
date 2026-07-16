import { useState } from 'react'
import { CreditCard, LayoutGrid, Receipt, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CurrentPlanCard } from './components/CurrentPlanCard'
import { PlanCard, type PlanAction } from './components/PlanCard'
import { BillingHistory } from './components/BillingHistory'
import { PaymentMethodCard } from './components/PaymentMethod'
import type { PlanTier, CurrentPlan, PaymentMethod as PaymentMethodType } from '@/types/subscription'

type Tab = 'plan' | 'billing' | 'payment'

const PLAN_TIERS: PlanTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    pricePerMonth: 19,
    pricePerYear: 190,
    features: [
      'Up to 3 workspace users',
      'Core CRM workflows (Lead, Prospect, Customer)',
      'Standard email support',
      '5 GB document storage',
    ],
    highlighted: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    pricePerMonth: 49,
    pricePerYear: 490,
    features: [
      'Up to 15 workspace users',
      'Custom fields & dynamic workflows',
      'Priority email & chat support',
      '50 GB document storage',
      'Advanced role-based access control',
    ],
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    pricePerMonth: null,
    pricePerYear: null,
    features: [
      'Unlimited workspace users',
      'Dedicated onboarding & success manager',
      'SSO / OAuth & custom SLAs',
      'Unlimited document storage',
      'Custom integrations',
    ],
    highlighted: false,
  },
]

const CURRENT_PLAN: CurrentPlan = {
  tier: PLAN_TIERS[1],
  renewalDate: '2024-08-01',
  status: 'active',
}

const PAYMENT_METHOD: PaymentMethodType = {
  brand: 'Visa',
  last4: '4242',
  expiry: '09/27',
}

const TIER_ORDER: Record<PlanTier['id'], number> = { starter: 0, pro: 1, enterprise: 2 }

function actionFor(tier: PlanTier, currentId: PlanTier['id']): PlanAction {
  if (tier.id === currentId) return 'current'
  if (tier.id === 'enterprise') return 'contact'
  return TIER_ORDER[tier.id] > TIER_ORDER[currentId] ? 'upgrade' : 'downgrade'
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'plan', label: 'Plan', icon: LayoutGrid },
  { id: 'billing', label: 'Billing', icon: Receipt },
  { id: 'payment', label: 'Payment', icon: Wallet },
]

export default function SubscriptionPage() {
  const [activeTab, setActiveTab] = useState<Tab>('plan')

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-3 sm:p-6 3xl:p-10 4xl:p-14 flex flex-col gap-3">

        {/* ── Page header ── */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/20 text-brand-dark">
            <CreditCard className="size-4.5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900">Subscription</h1>
            <p className="text-xs text-stone-500 mt-0.5">Manage your plan, billing history, and payment method</p>
          </div>
        </div>

        {/* ── Tab bar ── */}
        <nav className="inline-flex w-fit gap-1.5 self-start overflow-x-auto rounded-2xl border border-stone-200 bg-white p-1.5 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'group flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-left transition-all duration-150 cursor-pointer',
                activeTab === id
                  ? 'bg-[#001219] text-white shadow-sm'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
              )}
            >
              <Icon className={cn('size-3.5 shrink-0', activeTab === id ? 'text-brand' : 'text-stone-400 group-hover:text-stone-600')} />
              <span className="text-xs font-semibold whitespace-nowrap">{label}</span>
            </button>
          ))}
        </nav>

        {/* ── Plan tab ── */}
        {activeTab === 'plan' && (
          <div className="flex flex-col gap-3">
            <CurrentPlanCard
              plan={CURRENT_PLAN}
              onUpgrade={() => setActiveTab('plan')}
              onCancel={() => {}}
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {PLAN_TIERS.map((tier) => (
                <PlanCard
                  key={tier.id}
                  tier={tier}
                  billingCycle="monthly"
                  action={actionFor(tier, CURRENT_PLAN.tier.id)}
                  onSelect={() => {}}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Billing tab ── */}
        {activeTab === 'billing' && <BillingHistory />}

        {/* ── Payment tab ── */}
        {activeTab === 'payment' && <PaymentMethodCard method={PAYMENT_METHOD} onUpdate={() => {}} />}

      </div>
    </div>
  )
}
