import { useForm } from 'react-hook-form'
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
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ContactSalesFormValues>({
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
          {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
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
          {errors.workEmail && <p className="text-xs text-red-600 mt-1">{errors.workEmail.message}</p>}
        </div>

        <div>
          <label htmlFor="contact-sales-company-size" className={dialogLabelCls}>Company size</label>
          <select
            id="contact-sales-company-size"
            aria-invalid={Boolean(errors.companySize)}
            aria-label="Company size"
            className={errors.companySize ? dialogFieldErrorCls : dialogFieldCls}
            defaultValue=""
            {...register('companySize')}
          >
            <option value="" disabled>Select company size</option>
            {COMPANY_SIZE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {errors.companySize && <p className="text-xs text-red-600 mt-1">{errors.companySize.message}</p>}
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
            className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition-colors cursor-pointer"
            aria-label="Cancel contact sales"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-stone-950 hover:bg-brand-hover active:scale-[0.99] disabled:opacity-70 transition-all cursor-pointer"
            style={{ boxShadow: '0 4px 14px rgba(194,245,137,0.35)' }}
            aria-label="Send message to sales"
          >
            {isSubmitting ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </SubscriptionDialogShell>
  )
}
