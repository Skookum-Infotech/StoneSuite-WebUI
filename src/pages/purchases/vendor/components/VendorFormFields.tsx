import { ModernFieldShell } from '@/components/crm/FormPrimitives';
import { fieldCls, fieldErrorCls, textareaCls } from '@/components/crm/formUtils';
import type { CrmLookups } from '@/services/lookupService';
import type { VendorFormField } from '@/lib/vendorForm';

// Renders one VendorFormField — mirrors SOField (SalesOrderFormFields.tsx)
// for visual/behavioral consistency, extended with a 'url' input type for
// the compliance-policy links.
export function VendorField({ field, value, set, lookups, showError }: {
  field: VendorFormField;
  value: unknown;
  set: (k: string, v: unknown) => void;
  lookups?: CrmLookups;
  showError?: boolean;
}) {
  const str = typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
  const invalid = Boolean(showError && field.required && !str.trim());
  const colClass = field.colSpanFull ? 'col-span-full' : field.colSpan2 ? 'sm:col-span-2' : '';

  if (field.type === 'textarea') {
    return (
      <div className={colClass}>
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
    const lookupRows = field.lookupKey && lookups
      ? (lookups[field.lookupKey] as Array<{ id: number; name: string }>)
      : null;

    return (
      <div className={colClass}>
        <ModernFieldShell label={field.label} required={field.required}>
          <select
            required={field.required}
            value={str}
            onChange={(e) => set(field.key, e.target.value)}
            className={fieldCls}
            aria-label={field.label}
          >
            <option value="">— Select —</option>
            {lookupRows
              ? lookupRows.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)
              : field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </ModernFieldShell>
      </div>
    );
  }

  return (
    <div className={colClass}>
      <ModernFieldShell label={field.label} required={field.required}>
        <input
          type={field.type}
          required={field.required}
          value={str}
          onChange={(e) => set(field.key, e.target.value)}
          className={invalid ? fieldErrorCls : fieldCls}
          placeholder={field.placeholder}
          aria-label={field.label}
        />
      </ModernFieldShell>
    </div>
  );
}

export function VendorSectionGrid({ fields, data, set, lookups, maxCols = 3, showErrors }: {
  fields: VendorFormField[];
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  lookups?: CrmLookups;
  maxCols?: 2 | 3;
  showErrors?: boolean;
}) {
  return (
    <div className={`grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 ${maxCols === 3 ? 'lg:grid-cols-3' : ''}`}>
      {fields.map((f) => (
        <VendorField
          key={f.key}
          field={f}
          value={data[f.key]}
          set={set}
          lookups={lookups}
          showError={showErrors}
        />
      ))}
    </div>
  );
}
