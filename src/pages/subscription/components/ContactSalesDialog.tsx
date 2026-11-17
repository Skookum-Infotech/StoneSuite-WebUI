import { Select } from '@/components/ui/select';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Mail } from 'lucide-react'
import { contactSalesSchema, COMPANY_SIZE_OPTIONS, type ContactSalesFormValues } from '@/lib/subscriptionForm'
import { dialogFieldCls, dialogFieldErrorCls, dialogTextareaCls, dialogLabelCls } from '../formUtils'
import { SubscriptionDialogShell } from './SubscriptionDialogShell'

export function ContactSalesDialog({
  defaultValues,
  onClose,
  onSubmit,
}: {
  defaultValues: Partial<Pick<ContactSalesFormValues, 'name' | 'workEmail'>>
  onClose: () => void
  onSubmit: (data: ContactSalesFormValues) => void
}) {
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<ContactSalesFormValues>({
    resolver: zodResolver(contactSalesSchema),
    defaultValues: { name: defaultValues.name ?? '', workEmail: defaultValues.workEmail ?? '', message: '' },
  })

  async function submit(data: ContactSalesFormValues) {
    onSubmit(data)
  }

  return (
    <SubscriptionDialogShell
      header={{
        title: 'Contact Sales',
        description: 'Tell us about your team and we’ll reach out to discuss Enterprise pricing.',
        icon: Mail,
      }}
      onClose={onClose}
      widthClassName="max-w-md"
    >
      <form onSubmit={handleSubmit(submit)} className="space-y-3.5" noValidate>
        <div>
          <label htmlFor="contact-sales-name" className={dialogLabelCls}>Name</label>
          <input
            id="contact-sales-name"
            type="text"
            aria-invalid={Boolean(errors.name)}
            aria-label="Name"
            className={errors.name ? dialogFieldErrorCls : dialogFieldCls}
            {...register('name')}
          />
          {errors.name && <p className="mt-1 type-error">{errors.name.message}</p>}
        </div>

        <div>
          <label htmlFor="contact-sales-email" className={dialogLabelCls}>Work email</label>
          <input
            id="contact-sales-email"
            type="email"
            aria-invalid={Boolean(errors.workEmail)}
            aria-label="Work email"
            className={errors.workEmail ? dialogFieldErrorCls : dialogFieldCls}
            {...register('workEmail')}
          />
          {errors.workEmail && <p className="mt-1 type-error">{errors.workEmail.message}</p>}
        </div>

        <div>
          <label htmlFor="contact-sales-company-size" className={dialogLabelCls}>Company size</label>
          <Controller
            control={control}
            name="companySize"
            render={({ field }) => (
              <Select
                id="contact-sales-company-size"
                aria-invalid={Boolean(errors.companySize)}
                aria-label="Company size"
                className={errors.companySize ? dialogFieldErrorCls : dialogFieldCls}
                name={field.name}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value)}
              >
                <option value="" disabled>Select company size</option>
                {COMPANY_SIZE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            )}
          />
          {errors.companySize && <p className="mt-1 type-error">{errors.companySize.message}</p>}
        </div>

        <div>
          <label htmlFor="contact-sales-message" className={dialogLabelCls}>Message (optional)</label>
          <textarea
            id="contact-sales-message"
            rows={3}
            aria-label="Message"
            className={dialogTextareaCls}
            placeholder="What are you hoping to achieve with StoneSuite?"
            {...register('message')}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className={buttonVariants({ variant: 'outline' })}
            aria-label="Cancel contact sales"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(buttonVariants({ size: 'lg' }), 'active:scale-[0.99]')}
            aria-label="Send message to sales"
          >
            {isSubmitting ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </SubscriptionDialogShell>
  )
}
