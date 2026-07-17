import { useState } from 'react'
import { CreditCard, Star, Trash2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AddPaymentMethodFormValues } from '@/lib/subscriptionForm'
import { AddPaymentMethodDialog } from './AddPaymentMethodDialog'
import { RemovePaymentMethodDialog } from './RemovePaymentMethodDialog'
import type { PaymentMethod } from '@/types/subscription'

const BRAND_STYLE: Record<PaymentMethod['brand'], string> = {
  Visa: 'bg-blue-600',
  Mastercard: 'bg-orange-500',
  Amex: 'bg-sky-700',
}

export function PaymentMethodCard({
  methods,
  onAddCard,
  onRemoveCard,
  onSetDefault,
}: {
  methods: PaymentMethod[]
  onAddCard: (data: AddPaymentMethodFormValues) => void
  onRemoveCard: (id: string) => void
  onSetDefault: (id: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<PaymentMethod | null>(null)

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-stone-100 bg-stone-50/60">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/20 text-brand-dark">
            <CreditCard className="size-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-stone-900">Payment Methods</h2>
            <p className="text-xs text-stone-500 mt-0.5">Used for your subscription billing</p>
          </div>
        </div>
      </div>

      <div className="px-5 sm:px-6 py-4 sm:py-5 space-y-2.5">
        {methods.map((method) => (
          <div key={method.id} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3.5">
            <div className={cn('flex h-9 w-14 shrink-0 items-center justify-center rounded-md text-2xs font-black italic tracking-tight text-white', BRAND_STYLE[method.brand])}>
              {method.brand.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-stone-800 tabular-nums">•••• •••• •••• {method.last4}</p>
                {method.isDefault && (
                  <span className="inline-flex items-center rounded-full bg-brand/20 px-2 py-0.5 text-2xs font-bold text-brand-dark">
                    Default
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-400 mt-0.5">Expires {method.expiry}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!method.isDefault && (
                <button
                  type="button"
                  onClick={() => onSetDefault(method.id)}
                  aria-label={`Set ${method.brand} ending ${method.last4} as default`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors cursor-pointer"
                >
                  <Star className="size-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setRemoving(method)}
                disabled={methods.length === 1}
                aria-label={`Remove ${method.brand} ending ${method.last4}`}
                title={methods.length === 1 ? 'Add another card before removing your last one' : undefined}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-stone-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-stone-300 bg-white px-4 py-2.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 hover:border-stone-400 transition-colors cursor-pointer"
          aria-label="Add payment method"
        >
          <Plus className="size-3.5" />
          Add Payment Method
        </button>
      </div>

      {adding && (
        <AddPaymentMethodDialog
          onClose={() => setAdding(false)}
          onAdd={(data) => {
            onAddCard(data)
            setAdding(false)
          }}
        />
      )}

      {removing && (
        <RemovePaymentMethodDialog
          method={removing}
          onClose={() => setRemoving(null)}
          onConfirm={() => {
            onRemoveCard(removing.id)
            setRemoving(null)
          }}
        />
      )}
    </div>
  )
}
