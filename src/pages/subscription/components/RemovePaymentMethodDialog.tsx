import { Trash2 } from 'lucide-react'
import { SubscriptionDialogShell } from './SubscriptionDialogShell'
import type { PaymentMethod } from '@/types/subscription'

export function RemovePaymentMethodDialog({
  method,
  onClose,
  onConfirm,
}: {
  method: PaymentMethod
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <SubscriptionDialogShell
      header={{
        title: 'Remove this card?',
        description: `${method.brand} •••• ${method.last4} will be removed from your account.`,
        icon: Trash2,
        tone: 'destructive',
      }}
      onClose={onClose}
    >
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer"
          aria-label="Cancel remove card"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-700 active:scale-[0.99] transition-all cursor-pointer"
          aria-label="Confirm remove card"
        >
          Remove Card
        </button>
      </div>
    </SubscriptionDialogShell>
  )
}
