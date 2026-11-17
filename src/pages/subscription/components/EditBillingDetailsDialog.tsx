import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Building2 } from 'lucide-react'
import { billingContactSchema, type BillingContactFormValues } from '@/lib/subscriptionForm'
import { dialogFieldCls, dialogFieldErrorCls, dialogLabelCls } from '../formUtils'
import { SubscriptionDialogShell } from './SubscriptionDialogShell'
import type { BillingContact } from '@/types/subscription'

export function EditBillingDetailsDialog({
  contact,
  onClose,
  onSave,
}: {
  contact: BillingContact
  onClose: () => void
  onSave: (data: BillingContactFormValues) => void
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<BillingContactFormValues>({
    resolver: zodResolver(billingContactSchema),
    defaultValues: contact,
  })

  async function submit(data: BillingContactFormValues) {
    onSave(data)
  }

  return (
    <SubscriptionDialogShell
      header={{ title: 'Edit Billing Details', icon: Building2 }}
      onClose={onClose}
      widthClassName="max-w-md"
    >
      <form onSubmit={handleSubmit(submit)} className="space-y-3.5" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="billing-name" className={dialogLabelCls}>Name</label>
            <input id="billing-name" type="text" aria-label="Billing contact name" className={errors.name ? dialogFieldErrorCls : dialogFieldCls} {...register('name')} />
            {errors.name && <p className="mt-1 type-error">{errors.name.message}</p>}
          </div>
          <div>
            <label htmlFor="billing-email" className={dialogLabelCls}>Email</label>
            <input id="billing-email" type="email" aria-label="Billing contact email" className={errors.email ? dialogFieldErrorCls : dialogFieldCls} {...register('email')} />
            {errors.email && <p className="mt-1 type-error">{errors.email.message}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="billing-address1" className={dialogLabelCls}>Address line 1</label>
          <input id="billing-address1" type="text" aria-label="Address line 1" className={errors.addressLine1 ? dialogFieldErrorCls : dialogFieldCls} {...register('addressLine1')} />
          {errors.addressLine1 && <p className="mt-1 type-error">{errors.addressLine1.message}</p>}
        </div>

        <div>
          <label htmlFor="billing-address2" className={dialogLabelCls}>Address line 2 (optional)</label>
          <input id="billing-address2" type="text" aria-label="Address line 2" className={dialogFieldCls} {...register('addressLine2')} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="billing-city" className={dialogLabelCls}>City</label>
            <input id="billing-city" type="text" aria-label="City" className={errors.city ? dialogFieldErrorCls : dialogFieldCls} {...register('city')} />
            {errors.city && <p className="mt-1 type-error">{errors.city.message}</p>}
          </div>
          <div>
            <label htmlFor="billing-state" className={dialogLabelCls}>State</label>
            <input id="billing-state" type="text" aria-label="State" className={errors.state ? dialogFieldErrorCls : dialogFieldCls} {...register('state')} />
            {errors.state && <p className="mt-1 type-error">{errors.state.message}</p>}
          </div>
          <div>
            <label htmlFor="billing-postal" className={dialogLabelCls}>Postal code</label>
            <input id="billing-postal" type="text" aria-label="Postal code" className={errors.postalCode ? dialogFieldErrorCls : dialogFieldCls} {...register('postalCode')} />
            {errors.postalCode && <p className="mt-1 type-error">{errors.postalCode.message}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="billing-country" className={dialogLabelCls}>Country</label>
          <input id="billing-country" type="text" aria-label="Country" className={errors.country ? dialogFieldErrorCls : dialogFieldCls} {...register('country')} />
          {errors.country && <p className="mt-1 type-error">{errors.country.message}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-1.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className={buttonVariants({ variant: 'outline' })}
            aria-label="Cancel editing billing details"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(buttonVariants({ size: 'lg' }), 'active:scale-[0.99]')}
            aria-label="Save billing details"
          >
            {isSubmitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </SubscriptionDialogShell>
  )
}
