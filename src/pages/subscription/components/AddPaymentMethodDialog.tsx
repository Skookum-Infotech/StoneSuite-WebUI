import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreditCard } from 'lucide-react'
import { addPaymentMethodSchema, type AddPaymentMethodFormValues } from '@/lib/subscriptionForm'
import { dialogFieldCls, dialogFieldErrorCls, dialogLabelCls } from '../formUtils'
import { SubscriptionDialogShell } from './SubscriptionDialogShell'

export function AddPaymentMethodDialog({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (data: AddPaymentMethodFormValues) => void
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AddPaymentMethodFormValues>({
    resolver: zodResolver(addPaymentMethodSchema),
    defaultValues: { cardNumber: '', expiry: '', cvc: '', cardholderName: '' },
  })

  async function submit(data: AddPaymentMethodFormValues) {
    onAdd(data)
  }

  return (
    <SubscriptionDialogShell
      header={{
        title: 'Add Payment Method',
        description: 'This is a mock form — no real card data is processed or stored.',
        icon: CreditCard,
      }}
      onClose={onClose}
      widthClassName="max-w-sm"
    >
      <form onSubmit={handleSubmit(submit)} className="space-y-3.5" noValidate>
        <div>
          <label htmlFor="add-card-number" className={dialogLabelCls}>Card number</label>
          <input
            id="add-card-number"
            type="text"
            inputMode="numeric"
            placeholder="1234 1234 1234 1234"
            aria-invalid={Boolean(errors.cardNumber)}
            aria-label="Card number"
            className={errors.cardNumber ? dialogFieldErrorCls : dialogFieldCls}
            {...register('cardNumber')}
          />
          {errors.cardNumber && <p className="text-xs text-red-600 mt-1">{errors.cardNumber.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="add-card-expiry" className={dialogLabelCls}>Expiry</label>
            <input
              id="add-card-expiry"
              type="text"
              placeholder="MM/YY"
              aria-invalid={Boolean(errors.expiry)}
              aria-label="Expiry date"
              className={errors.expiry ? dialogFieldErrorCls : dialogFieldCls}
              {...register('expiry')}
            />
            {errors.expiry && <p className="text-xs text-red-600 mt-1">{errors.expiry.message}</p>}
          </div>
          <div>
            <label htmlFor="add-card-cvc" className={dialogLabelCls}>CVC</label>
            <input
              id="add-card-cvc"
              type="text"
              inputMode="numeric"
              placeholder="123"
              aria-invalid={Boolean(errors.cvc)}
              aria-label="CVC"
              className={errors.cvc ? dialogFieldErrorCls : dialogFieldCls}
              {...register('cvc')}
            />
            {errors.cvc && <p className="text-xs text-red-600 mt-1">{errors.cvc.message}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="add-card-name" className={dialogLabelCls}>Cardholder name</label>
          <input
            id="add-card-name"
            type="text"
            aria-invalid={Boolean(errors.cardholderName)}
            aria-label="Cardholder name"
            className={errors.cardholderName ? dialogFieldErrorCls : dialogFieldCls}
            {...register('cardholderName')}
          />
          {errors.cardholderName && <p className="text-xs text-red-600 mt-1">{errors.cardholderName.message}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-1.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition-colors cursor-pointer"
            aria-label="Cancel adding payment method"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-stone-950 hover:bg-brand-hover active:scale-[0.99] disabled:opacity-70 transition-all cursor-pointer"
            style={{ boxShadow: '0 4px 14px rgba(194,245,137,0.35)' }}
            aria-label="Add card"
          >
            {isSubmitting ? 'Adding…' : 'Add Card'}
          </button>
        </div>
      </form>
    </SubscriptionDialogShell>
  )
}
