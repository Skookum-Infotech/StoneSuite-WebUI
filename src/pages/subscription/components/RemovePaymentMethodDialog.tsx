import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
          className={buttonVariants({ variant: 'outline' })}
          aria-label="Cancel remove card"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={cn(buttonVariants({ variant: 'destructive' }), 'active:scale-[0.99]')}
          aria-label="Confirm remove card"
        >
          Remove Card
        </button>
      </div>
    </SubscriptionDialogShell>
  )
}
