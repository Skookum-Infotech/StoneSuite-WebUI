import { ModernFieldShell } from '@/components/crm/FormPrimitives';
import { fieldCls, textareaCls, readonlyCls } from '@/components/crm/formUtils';
import type { CrmLookups } from '@/services/lookupService';
import type { VendorCreditFormField } from '@/lib/vendorCreditForm';

// Renders one VendorCreditFormField — shared by the Add and Edit Vendor
// Credit forms. Mirrors VendorPaymentFormFields, minus the idOptions escape
// hatch (Vendor Credit has no method-style select bound to a static list).
export function VendorCreditField({ field, value, set, lookups }: {
  field: VendorCreditFormField;
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
      </div>
    );
  }

  if (field.type === 'select') {
    const idRows = field.lookupKey && lookups ? (lookups[field.lookupKey] as Array<{ id: number; name: string }>) : [];

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
            {idRows.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
        </ModernFieldShell>
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
    </div>
  );
}

export function VendorCreditSectionGrid({ fields, data, set, lookups }: {
  fields: VendorCreditFormField[];
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  lookups?: CrmLookups;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((f) => (
        <VendorCreditField key={f.key} field={f} value={data[f.key]} set={set} lookups={lookups} />
      ))}
    </div>
  );
}
