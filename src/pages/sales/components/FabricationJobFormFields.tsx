import { ModernFieldShell } from '@/components/crm/FormPrimitives';
import { fieldCls, textareaCls, readonlyCls } from '@/components/crm/formUtils';
import { DatePicker } from '@/components/ui/date-picker';
import type { CrmLookups } from '@/services/lookupService';
import type { FJFormField } from '@/lib/fabricationForm';

// Renders one FJFormField — shared by the Add and Edit Fabrication Job forms.
// Mirrors SOField's structure (see salesOrderForm's field-renderer pattern)
// but kept as its own copy rather than shared, matching how each sales
// document module (Quote/Invoice/Refund/etc.) owns its own field renderer.
export function FJField({ field, value, set, lookups }: {
  field: FJFormField;
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
    const lookupRows = field.lookupKey && lookups
      ? (lookups[field.lookupKey] as Array<{ id: number; name: string }>)
      : null;

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
            {lookupRows?.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
          {field.hint && <p className="text-2xs text-stone-400">{field.hint}</p>}
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
          aria-label={field.label}
        />
        {field.hint && <p className="text-2xs text-stone-400">{field.hint}</p>}
      </ModernFieldShell>
    </div>
  );
}

export function FJSectionGrid({ fields, data, set, lookups, maxCols = 3 }: {
  fields: FJFormField[];
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  lookups?: CrmLookups;
  maxCols?: 2 | 3;
}) {
  return (
    <div className={`grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 ${maxCols === 3 ? 'lg:grid-cols-3' : ''}`}>
      {fields.map((f) => (
        <FJField key={f.key} field={f} value={data[f.key]} set={set} lookups={lookups} />
      ))}
    </div>
  );
}
