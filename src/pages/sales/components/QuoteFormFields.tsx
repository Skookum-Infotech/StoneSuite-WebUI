import { ModernFieldShell } from '@/components/crm/FormPrimitives';
import {
  fieldCls, textareaCls, readonlyCls, checkboxLabelCls,
} from '@/components/crm/formUtils';
import type { CrmLookups } from '@/services/lookupService';
import type { QuoteFormField } from '@/lib/quoteForm';

// Renders one QuoteFormField — shared by the Add and Edit Quote forms.
// Mirrors EstimateFormFields' EstimateField/EstimateSectionGrid.
export function QuoteField({ field, value, set, lookups, dependsOnValue }: {
  field: QuoteFormField;
  value: unknown;
  set: (k: string, v: unknown) => void;
  lookups?: CrmLookups;
  /** Current value of the field named by `field.dependsOn`, when set. Kept
   *  for parity with EstimateField's signature — no current Quote field uses
   *  dependsOn (Quote's address fields are plain text, not lookup-driven). */
  dependsOnValue?: unknown;
}) {
  const str = typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
  const checked = value === true;

  if (field.type === 'checkbox') {
    return (
      <div className="col-span-full flex items-center gap-3 py-1.5">
        <input
          type="checkbox"
          id={field.key}
          checked={checked}
          onChange={(e) => set(field.key, e.target.checked)}
          className="h-4 w-4 rounded border border-stone-300 accent-brand cursor-pointer shrink-0 bg-white [color-scheme:light]"
          aria-label={field.label}
        />
        <label htmlFor={field.key} className={`${checkboxLabelCls} cursor-pointer select-none`}>
          {field.label}
          {field.required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
      </div>
    );
  }

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
    // lookupKey fields (payment terms/price level/currency/employee) source
    // their options from CrmLookups by numeric id, so the stored value is
    // the id (string) — matching the create payload's *Id fields — rather
    // than a display label.
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
        {field.hint && <p className="text-2xs text-stone-400">{field.hint}</p>}
      </ModernFieldShell>
    </div>
  );
}

export function QuoteSectionGrid({ fields, data, set, lookups, maxCols = 3 }: {
  fields: QuoteFormField[];
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  lookups?: CrmLookups;
  maxCols?: 2 | 3;
}) {
  const visible = fields.filter((f) =>
    f.showIfFieldFalse ? !data[f.showIfFieldFalse] : true,
  );
  return (
    <div className={`grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 ${maxCols === 3 ? 'lg:grid-cols-3' : ''}`}>
      {visible.map((f) => (
        <QuoteField
          key={f.key}
          field={f}
          value={data[f.key]}
          set={set}
          lookups={lookups}
          dependsOnValue={f.dependsOn ? data[f.dependsOn] : undefined}
        />
      ))}
    </div>
  );
}
