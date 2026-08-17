import { ModernFieldShell } from '@/components/crm/FormPrimitives';
import { fieldCls, textareaCls, readonlyCls } from '@/components/crm/formUtils';
import type { ExpenseFormField } from '@/lib/expenseForm';

// Renders one ExpenseFormField — shared by the Add and Edit Expense forms.
// Mirrors RequisitionField, minus the lookupKey select variant — an expense
// header has no FK-backed select (no vendor, no payment terms; the claimant
// is never a form field at all, spec AD-2).
export function ExpenseField({ field, value, set }: {
  field: ExpenseFormField;
  value: unknown;
  set: (k: string, v: unknown) => void;
}) {
  const str = typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
  const spanCls = field.colSpanFull ? 'col-span-full' : '';

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
            {field.options?.filter(Boolean).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {field.hint && <p className="text-2xs text-stone-400">{field.hint}</p>}
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
        />
        {field.hint && <p className="text-2xs text-stone-400">{field.hint}</p>}
      </ModernFieldShell>
    </div>
  );
}

export function ExpenseSectionGrid({ fields, data, set }: {
  fields: ExpenseFormField[];
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
      {fields.map((f) => (
        <ExpenseField key={f.key} field={f} value={data[f.key]} set={set} />
      ))}
    </div>
  );
}
