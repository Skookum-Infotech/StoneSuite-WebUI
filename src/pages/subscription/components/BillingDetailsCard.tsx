import { useState } from 'react'
import { Building2, Pencil } from 'lucide-react'
import { EditBillingDetailsDialog } from './EditBillingDetailsDialog'
import type { BillingContact } from '@/types/subscription'

export function BillingDetailsCard({
  contact,
  onSave,
}: {
  contact: BillingContact
  onSave: (contact: BillingContact) => void
}) {
  const [editing, setEditing] = useState(false)

  return (
    <div className="h-full flex flex-col rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-stone-100 bg-stone-50/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/20 text-brand-dark">
            <Building2 className="size-4.5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-stone-900">Billing Details</h2>
            <p className="text-xs text-stone-500 mt-0.5">Where invoices and receipts are addressed</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit billing details"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 hover:text-stone-700 transition-colors cursor-pointer"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>

      <dl className="flex-1 px-5 sm:px-6 py-4 sm:py-5 space-y-4 text-xs flex flex-col justify-center">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-stone-400 font-semibold shrink-0">Contact</dt>
          <dd className="text-stone-800 text-right truncate">{contact.name}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-stone-400 font-semibold shrink-0">Email</dt>
          <dd className="text-stone-800 text-right truncate">{contact.email}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-stone-400 font-semibold shrink-0">Address</dt>
          <dd className="text-stone-800 text-right">
            {contact.addressLine1}
            {contact.addressLine2 ? `, ${contact.addressLine2}` : ''}
            <br />
            {contact.city}, {contact.state} {contact.postalCode}
            <br />
            {contact.country}
          </dd>
        </div>
      </dl>

      {editing && (
        <EditBillingDetailsDialog
          contact={contact}
          onClose={() => setEditing(false)}
          onSave={(data) => {
            onSave(data)
            setEditing(false)
          }}
        />
      )}
    </div>
  )
}
