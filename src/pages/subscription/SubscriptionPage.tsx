import { useEffect, useState } from 'react'
import { CreditCard, LayoutGrid, Receipt, Wallet, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/useAuthStore'
import { CurrentPlanCard } from './components/CurrentPlanCard'
import { PlanCard, type PlanAction } from './components/PlanCard'
import { BillingHistory } from './components/BillingHistory'
import { PaymentMethodCard } from './components/PaymentMethod'
import { BillingDetailsCard } from './components/BillingDetailsCard'
import { UpgradePlanDialog } from './components/UpgradePlanDialog'
import { CancelPlanDialog } from './components/CancelPlanDialog'
import { ContactSalesDialog } from './components/ContactSalesDialog'
import { toPaymentMethodInput } from '@/lib/subscriptionForm'
import type {
  PlanTier, CurrentPlan, PaymentMethod as PaymentMethodType, BillingContact, CancelReason,
} from '@/types/subscription'

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

const INITIAL_PLAN: CurrentPlan = {
  tier: PLAN_TIERS[1],
  renewalDate: '2024-08-01',
  status: 'active',
}

const INITIAL_PAYMENT_METHODS: PaymentMethodType[] = [
  { id: 'pm-1', brand: 'Visa', last4: '4242', expiry: '09/27', isDefault: true },
  { id: 'pm-2', brand: 'Mastercard', last4: '8210', expiry: '03/26', isDefault: false },
]

const INITIAL_BILLING_CONTACT: BillingContact = {
  name: 'Alex Morgan',
  email: 'billing@acme-crm.com',
  addressLine1: '480 Market Street',
  addressLine2: 'Suite 210',
  city: 'San Francisco',
  state: 'CA',
  postalCode: '94105',
  country: 'United States',
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

// Transient inline confirmation banner — this repo has no toast/notification
// library (see AccountSettingsPage's passwordSuccess pattern), so success
// feedback for the mock actions below (upgrade, cancel, contact sales, card
// changes) reuses the same auto-dismissing banner approach.
function useNotice() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 4000)
    return () => clearTimeout(t)
  }, [message])

  return { message, notify: setMessage }
}

let paymentMethodIdSeq = INITIAL_PAYMENT_METHODS.length

export default function SubscriptionPage() {
  const user = useAuthStore((s) => s.user)
  const [activeTab, setActiveTab] = useState<Tab>('plan')
  const { message: notice, notify } = useNotice()

  const [currentPlan, setCurrentPlan] = useState<CurrentPlan>(INITIAL_PLAN)
  const [upgradeTarget, setUpgradeTarget] = useState<PlanTier | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [contactingSales, setContactingSales] = useState(false)

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodType[]>(INITIAL_PAYMENT_METHODS)
  const [billingContact, setBillingContact] = useState<BillingContact>(INITIAL_BILLING_CONTACT)

  function handleUpgradeConfirm(targetTierId: PlanTier['id']) {
    const targetTier = PLAN_TIERS.find((t) => t.id === targetTierId)
    if (!targetTier) return
    setCurrentPlan((prev) => ({ ...prev, tier: targetTier, status: 'active' }))
    setUpgradeTarget(null)
    notify(`Upgraded to ${targetTier.name} Plan.`)
  }

  function handleCancelConfirm(_reason: CancelReason | null) {
    setCurrentPlan((prev) => ({ ...prev, status: 'canceled' }))
    setCancelling(false)
    notify(`Your plan remains active until ${new Date(currentPlan.renewalDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.`)
  }

  function handleAddCard(data: { cardNumber: string; expiry: string; cardholderName: string }) {
    const derived = toPaymentMethodInput(data)
    paymentMethodIdSeq += 1
    const method: PaymentMethodType = {
      id: `pm-${paymentMethodIdSeq}`,
      ...derived,
      isDefault: paymentMethods.length === 0,
    }
    setPaymentMethods((prev) => [...prev, method])
    notify('Payment method added.')
  }

  function handleRemoveCard(id: string) {
    setPaymentMethods((prev) => prev.filter((m) => m.id !== id))
    notify('Payment method removed.')
  }

  function handleSetDefault(id: string) {
    setPaymentMethods((prev) => prev.map((m) => ({ ...m, isDefault: m.id === id })))
    notify('Default payment method updated.')
  }

  function handleSaveBillingContact(data: BillingContact) {
    setBillingContact(data)
    notify('Billing details updated.')
  }

  function handleContactSalesSubmit() {
    setContactingSales(false)
    notify('Thanks — our team will reach out within 1 business day.')
  }

  const nextTier = PLAN_TIERS.find((t) => TIER_ORDER[t.id] === TIER_ORDER[currentPlan.tier.id] + 1) ?? null

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

        {/* ── Success banner ── */}
        {notice && (
          <div role="status" className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            {notice}
          </div>
        )}

        {/* ── Tab bar ── */}
        <nav className="inline-flex w-fit gap-1.5 self-start overflow-x-auto rounded-2xl border border-stone-200 bg-white p-1.5 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              aria-label={`${label} tab`}
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
              plan={currentPlan}
              onUpgrade={() => nextTier && setUpgradeTarget(nextTier)}
              onCancel={() => setCancelling(true)}
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {PLAN_TIERS.map((tier) => {
                const action = actionFor(tier, currentPlan.tier.id)
                return (
                  <PlanCard
                    key={tier.id}
                    tier={tier}
                    billingCycle="monthly"
                    action={action}
                    onSelect={(_id) => {
                      if (action === 'upgrade') setUpgradeTarget(tier)
                      else if (action === 'contact') setContactingSales(true)
                      // Downgrade: intentionally left as a no-op — out of scope.
                    }}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* ── Billing tab ── */}
        {activeTab === 'billing' && <BillingHistory />}

        {/* ── Payment tab ── */}
        {activeTab === 'payment' && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 items-stretch">
            <PaymentMethodCard
              methods={paymentMethods}
              onAddCard={handleAddCard}
              onRemoveCard={handleRemoveCard}
              onSetDefault={handleSetDefault}
            />
            <BillingDetailsCard contact={billingContact} onSave={handleSaveBillingContact} />
          </div>
        )}

      </div>

      {upgradeTarget && (
        <UpgradePlanDialog
          plan={{ currentTier: currentPlan.tier, targetTier: upgradeTarget, billingCycle: 'monthly', renewalDate: currentPlan.renewalDate }}
          onClose={() => setUpgradeTarget(null)}
          onConfirm={handleUpgradeConfirm}
        />
      )}

      {cancelling && (
        <CancelPlanDialog
          plan={currentPlan}
          onClose={() => setCancelling(false)}
          onConfirm={handleCancelConfirm}
        />
      )}

      {contactingSales && (
        <ContactSalesDialog
          defaultValues={{ name: user?.fullName, workEmail: user?.email }}
          onClose={() => setContactingSales(false)}
          onSubmit={handleContactSalesSubmit}
        />
      )}
    </div>
  )
}
