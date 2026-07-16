import { CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PaymentMethod } from '@/types/subscription'

const BRAND_STYLE: Record<PaymentMethod['brand'], string> = {
  Visa: 'bg-blue-600',
  Mastercard: 'bg-orange-500',
  Amex: 'bg-sky-700',
}

interface PaymentMethodCardProps {
  method: PaymentMethod
  onUpdate: () => void
}

export function PaymentMethodCard({ method, onUpdate }: PaymentMethodCardProps) {
  return (
    <div className="max-w-md rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-stone-100 bg-stone-50/60">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/20 text-brand-dark">
            <CreditCard className="size-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-stone-900">Payment Method</h2>
            <p className="text-xs text-stone-500 mt-0.5">Used for your subscription billing</p>
          </div>
        </div>
      </div>
      <div className="px-5 sm:px-6 py-4 sm:py-5">
        <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3.5">
          <div className={cn('flex h-9 w-14 shrink-0 items-center justify-center rounded-md text-2xs font-black italic tracking-tight text-white', BRAND_STYLE[method.brand])}>
            {method.brand.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-stone-800 tabular-nums">•••• •••• •••• {method.last4}</p>
            <p className="text-xs text-stone-400 mt-0.5">Expires {method.expiry}</p>
          </div>
        </div>
        <button
          onClick={onUpdate}
          className="mt-3 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer"
          aria-label="Update payment method"
        >
          Update Payment
        </button>
      </div>
    </div>
  )
}
