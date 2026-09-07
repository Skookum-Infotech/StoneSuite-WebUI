import { ModernFieldShell } from '@/components/crm/FormPrimitives';
import {
  fieldCls, textareaCls, readonlyCls,
} from '@/components/crm/formUtils';
import { DatePicker } from '@/components/ui/date-picker';
import type { CrmLookups } from '@/services/lookupService';
import type { CreditMemoFormField } from '@/lib/creditMemoForm';

// Renders one CreditMemoFormField — shared by the Add and Edit Credit Memo
// forms. Mirrors InvoiceFormFields' InvoiceField/InvoiceSectionGrid.
export function CreditMemoField({ field, value, set, lookups, dependsOnValue, disabled }: {
  field: CreditMemoFormField;
  value: unknown;
  set: (k: string, v: unknown) => void;
  lookups?: CrmLookups;
  /** Current value of the field named by `field.dependsOn`, when set (e.g.
   *  the country id a state select filters by). */
  dependsOnValue?: unknown;
  /** Forces the field to its read-only rendering — used on the Edit page for
   *  "money fields" once the credit memo has left DRFT. */
  disabled?: boolean;
}) {
  const str = typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);

  if (field.type === 'readonly' || disabled) {
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
    // lookupKey fields (country/state) source their options from CrmLookups
    // by numeric id, so the stored value is the id (string) rather than a
    // display label.
    const lookupRows = field.lookupKey && lookups
      ? (lookups[field.lookupKey] as Array<{ id: number; name: string; countryId?: number }>)
      : null;
    const dependsOnUnset = Boolean(field.dependsOn) && !dependsOnValue;
    const filteredRows = lookupRows && field.dependsOn
      ? lookupRows.filter((row) => String(row.countryId ?? '') === String(dependsOnValue ?? ''))
      : lookupRows;

    return (
      <div className={field.colSpanFull ? 'col-span-full' : field.colSpan2 ? 'sm:col-span-2' : ''}>
        <ModernFieldShell label={field.label} required={field.required}>
          <select
            required={field.required}
            value={str}
            onChange={(e) => set(field.key, e.target.value)}
            className={fieldCls}
            aria-label={field.label}
            disabled={dependsOnUnset}
          >
            <option value="">{dependsOnUnset ? '— Select a country first —' : '— Select —'}</option>
            {filteredRows
              ? filteredRows.map((row) => (
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

  if (field.type === 'date') {
    return (
      <div className={field.colSpanFull ? 'col-span-full' : field.colSpan2 ? 'sm:col-span-2' : ''}>
        <ModernFieldShell label={field.label} required={field.required}>
          <DatePicker value={str} onChange={(iso) => set(field.key, iso)} label={field.label} required={field.required} />
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
          min={field.min}
          max={field.max}
          aria-label={field.label}
        />
      </ModernFieldShell>
    </div>
  );
}

export function CreditMemoSectionGrid({ fields, data, set, lookups, maxCols = 3, moneyFieldsDisabled = false }: {
  fields: CreditMemoFormField[];
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  lookups?: CrmLookups;
  maxCols?: 2 | 3;
  /** Disables fields flagged `moneyField` — Edit page only, once the credit
   *  memo has left DRFT (spec: "Disable money fields when status != DRFT"). */
  moneyFieldsDisabled?: boolean;
}) {
  return (
    <div className={`grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 ${maxCols === 3 ? 'lg:grid-cols-3' : ''}`}>
      {fields.map((f) => (
        <CreditMemoField
          key={f.key}
          field={f}
          value={data[f.key]}
          set={set}
          lookups={lookups}
          dependsOnValue={f.dependsOn ? data[f.dependsOn] : undefined}
          disabled={moneyFieldsDisabled && f.moneyField}
        />
      ))}
    </div>
  );
}
