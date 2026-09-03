import { ModernFieldShell } from '@/components/crm/FormPrimitives';
import { fieldCls, textareaCls, readonlyCls } from '@/components/crm/formUtils';
import { DatePicker } from '@/components/ui/date-picker';
import type { CrmLookups } from '@/services/lookupService';
import type { VendorPaymentFormField } from '@/lib/vendorPaymentForm';

// Renders one VendorPaymentFormField — shared by the Add and Edit Vendor
// Payment forms. Mirrors PaymentFormFields' PaymentField/PaymentSectionGrid
// (same `idOptions` escape hatch for payment methods, which aren't part of
// CrmLookups), plus an optional per-field hint line — the Scheduled Date field
// needs to explain why it exists before the payment can be scheduled.
export function VendorPaymentField({ field, value, set, lookups }: {
  field: VendorPaymentFormField;
  value: unknown;
  set: (k: string, v: unknown) => void;
  lookups?: CrmLookups;
}) {
  const str = typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
  const spanCls = field.colSpanFull ? 'col-span-full' : field.colSpan2 ? 'sm:col-span-2' : '';

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
      <div className={spanCls}>
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
        <FieldHint hint={field.hint} />
      </div>
    );
  }

  if (field.type === 'select') {
    const idRows = field.idOptions
      ?? (field.lookupKey && lookups ? (lookups[field.lookupKey] as Array<{ id: number; name: string }>) : null);

    return (
      <div className={spanCls}>
        <ModernFieldShell label={field.label} required={field.required}>
          <select
            required={field.required}
            value={str}
            onChange={(e) => set(field.key, e.target.value)}
            className={fieldCls}
            aria-label={field.label}
          >
            <option value="">— Select —</option>
            {(idRows ?? []).map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
        </ModernFieldShell>
        <FieldHint hint={field.hint} />
      </div>
    );
  }

  if (field.type === 'date') {
    return (
      <div className={spanCls}>
        <ModernFieldShell label={field.label} required={field.required}>
          <DatePicker value={str} onChange={(iso) => set(field.key, iso)} label={field.label} required={field.required} />
        </ModernFieldShell>
        <FieldHint hint={field.hint} />
      </div>
    );
  }

  return (
    <div className={spanCls}>
      <ModernFieldShell label={field.label} required={field.required}>
        <input
          type={field.type ?? 'text'}
          required={field.required}
          value={str}
          onChange={(e) => set(field.key, e.target.value)}
          className={fieldCls}
          placeholder={field.placeholder}
          aria-label={field.label}
          {...(field.type === 'number' ? { min: '0.01', step: '0.01' } : {})}
        />
      </ModernFieldShell>
      <FieldHint hint={field.hint} />
    </div>
  );
}

function FieldHint({ hint }: { hint?: string }) {
  if (!hint) return null;
  return <p className="mt-1 text-2xs text-stone-400">{hint}</p>;
}

export function VendorPaymentSectionGrid({ fields, data, set, lookups }: {
  fields: VendorPaymentFormField[];
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  lookups?: CrmLookups;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((f) => (
        <VendorPaymentField key={f.key} field={f} value={data[f.key]} set={set} lookups={lookups} />
      ))}
    </div>
  );
}
