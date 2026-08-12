import { ModernFieldShell } from '@/components/crm/FormPrimitives';
import { fieldCls, textareaCls, readonlyCls } from '@/components/crm/formUtils';
import type { CrmLookups } from '@/services/lookupService';
import type { VendorBillFormField } from '@/lib/vendorBillForm';

// Renders one VendorBillFormField — shared by the Add and Edit Vendor Bill
// forms. Mirrors PurchaseOrderField (no dependsOn chain here — a vendor bill
// has no country/state address block to filter).
export function VendorBillField({ field, value, set, lookups }: {
  field: VendorBillFormField;
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
      <div className={field.colSpanFull ? 'col-span-full' : ''}>
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
    // lookupKey fields (payment terms/currency/employee) source their
    // options from CrmLookups by numeric id, so the stored value is the id
    // (string) — matching the create payload's *Id fields — rather than a
    // display label.
    const lookupRows = field.lookupKey && lookups
      ? (lookups[field.lookupKey] as Array<{ id: number; name: string }>)
      : null;

    return (
      <div className={field.colSpanFull ? 'col-span-full' : ''}>
        <ModernFieldShell label={field.label} required={field.required}>
          <select
            required={field.required}
            value={str}
            onChange={(e) => set(field.key, e.target.value)}
            className={fieldCls}
            aria-label={field.label}
          >
            <option value="">— Select —</option>
            {lookupRows?.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
        </ModernFieldShell>
      </div>
    );
  }

  return (
    <div className={field.colSpanFull ? 'col-span-full' : ''}>
      <ModernFieldShell label={field.label} required={field.required}>
        <input
          type={field.type ?? 'text'}
          required={field.required}
          value={str}
          onChange={(e) => set(field.key, e.target.value)}
          className={fieldCls}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          aria-label={field.label}
        />
        {field.hint && <p className="text-2xs text-stone-400">{field.hint}</p>}
      </ModernFieldShell>
    </div>
  );
}

export function VendorBillSectionGrid({ fields, data, set, lookups }: {
  fields: VendorBillFormField[];
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  lookups?: CrmLookups;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((f) => (
        <VendorBillField key={f.key} field={f} value={data[f.key]} set={set} lookups={lookups} />
      ))}
    </div>
  );
}
