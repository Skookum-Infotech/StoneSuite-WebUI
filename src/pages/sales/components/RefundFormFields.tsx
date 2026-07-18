import { ModernFieldShell } from '@/components/crm/FormPrimitives';
import { fieldCls, textareaCls, readonlyCls } from '@/components/crm/formUtils';
import type { CrmLookups } from '@/services/lookupService';
import type { RefundFormField } from '@/lib/refundForm';

// Renders one RefundFormField — shared by the Add and Edit Refund forms.
// Mirrors PaymentFormFields' PaymentField/PaymentSectionGrid; `idOptions`
// carries the reused PAYMENT_METHODS list (lkp_payment_method doubles as the
// refund-method lookup — refund spec §1's reuse table).
export function RefundField({ field, value, set, lookups }: {
  field: RefundFormField;
  value: unknown;
  set: (k: string, v: unknown) => void;
  lookups?: CrmLookups;
}) {
  const str = typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);

  if (field.type === 'readonly') {
    return (
      <ModernFieldShell label={field.label}>
        <div className={`${readonlyCls} cursor-not-allowed select-none`}>
          {str || <span className="text-stone-400">—</span>}
        </div>
      </ModernFieldShell>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div className={field.colSpanFull ? 'col-span-full' : field.colSpan2 ? 'sm:col-span-2' : ''}>
        <ModernFieldShell label={field.label} required={field.required}>
          <textarea
            rows={field.rows ?? 3}
            required={field.required}
            value={str}
            onChange={(e) => set(field.key, e.target.value)}
            className={textareaCls}
            placeholder={field.placeholder}
            aria-label={field.label}
          />
        </ModernFieldShell>
      </div>
    );
  }

  if (field.type === 'select') {
    const idRows = field.idOptions
      ?? (field.lookupKey && lookups ? (lookups[field.lookupKey] as Array<{ id: number; name: string }>) : null);

    return (
      <div className={field.colSpanFull ? 'col-span-full' : field.colSpan2 ? 'sm:col-span-2' : ''}>
        <ModernFieldShell label={field.label} required={field.required}>
          <select
            required={field.required}
            value={str}
            onChange={(e) => set(field.key, e.target.value)}
            className={fieldCls}
            aria-label={field.label}
          >
            <option value="">— Select —</option>
            {idRows
              ? idRows.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))
              : field.options?.filter(Boolean).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
          </select>
        </ModernFieldShell>
      </div>
    );
  }

  return (
    <div className={field.colSpanFull ? 'col-span-full' : field.colSpan2 ? 'sm:col-span-2' : ''}>
      <ModernFieldShell label={field.label} required={field.required}>
        <input
          type={field.type ?? 'text'}
          required={field.required}
          value={str}
          onChange={(e) => set(field.key, e.target.value)}
          className={fieldCls}
          placeholder={field.placeholder}
          aria-label={field.label}
        />
      </ModernFieldShell>
    </div>
  );
}

export function RefundSectionGrid({ fields, data, set, lookups }: {
  fields: RefundFormField[];
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  lookups?: CrmLookups;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((f) => (
        <RefundField key={f.key} field={f} value={data[f.key]} set={set} lookups={lookups} />
      ))}
    </div>
  );
}
