import { ModernFieldShell } from '@/components/crm/FormPrimitives';
import { fieldCls, textareaCls, readonlyCls } from '@/components/crm/formUtils';
import { DatePicker } from '@/components/ui/date-picker';
import type { CrmLookups } from '@/services/lookupService';
import type { JournalEntryFormField } from '@/lib/journalEntryForm';

// Renders one JournalEntryFormField — shared by the Add and Edit Journal
// Entry forms. Mirrors ItemReceiptField; From/To account fields are not part
// of this grid (see AccountPicker in the page body).
export function JournalEntryField({ field, value, set, lookups }: {
  field: JournalEntryFormField;
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
    );
  }

  if (field.type === 'select') {
    const lookupRows = field.lookupKey && lookups
      ? (lookups[field.lookupKey] as Array<{ id: number; name: string }>)
      : null;
    return (
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
    );
  }

  if (field.type === 'date') {
    return (
      <ModernFieldShell label={field.label} required={field.required}>
        <DatePicker value={str} onChange={(iso) => set(field.key, iso)} label={field.label} required={field.required} />
      </ModernFieldShell>
    );
  }

  return (
    <ModernFieldShell label={field.label} required={field.required}>
      <input
        type={field.type === 'number' ? 'number' : field.type}
        step={field.type === 'number' ? '0.01' : undefined}
        min={field.type === 'number' ? '0.01' : undefined}
        required={field.required}
        value={str}
        onChange={(e) => set(field.key, field.type === 'number' ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value)}
        className={fieldCls}
        placeholder={field.placeholder}
        aria-label={field.label}
      />
      {field.hint && <p className="text-2xs text-stone-400">{field.hint}</p>}
    </ModernFieldShell>
  );
}

export function JournalEntrySectionGrid({ fields, data, set, lookups }: {
  fields: JournalEntryFormField[];
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  lookups?: CrmLookups;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((f) => (
        <div key={f.key} className={f.colSpanFull ? 'col-span-full' : ''}>
          <JournalEntryField field={f} value={data[f.key]} set={set} lookups={lookups} />
        </div>
      ))}
    </div>
  );
}
