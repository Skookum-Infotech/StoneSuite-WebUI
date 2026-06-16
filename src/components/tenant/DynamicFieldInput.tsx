import { fieldCls } from '@/components/crm/formUtils';
import type { FieldDefinition } from '@/types/tenant';

/**
 * Renders the appropriate control for a workflow custom field definition.
 * Number fields emit a JS number (or empty string when blank); all others emit strings/booleans.
 */
export function DynamicFieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDefinition;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}) {
  const id = `field-${field.key}`;
  const labelText = field.label || field.key;

  const label = (
    <label htmlFor={id} className="block text-xs font-medium text-stone-500 leading-none">
      {labelText}
      {field.required && <span className="ml-0.5 text-red-400">*</span>}
    </label>
  );

  if (field.dataType === 'enum') {
    return (
      <div className="space-y-1.5">
        {label}
        <select
          id={id}
          aria-label={labelText}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={fieldCls}
        >
          <option value="">Select…</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.dataType === 'bool') {
    return (
      <div className="flex items-end pb-0.5">
        <label
          htmlFor={id}
          className="flex items-center gap-2.5 cursor-pointer select-none group"
        >
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(field.key, e.target.checked)}
            className="h-4 w-4 rounded border-stone-300 accent-brand cursor-pointer"
          />
          <span className="text-xs font-medium text-stone-600 group-hover:text-stone-800 transition-colors leading-none">
            {labelText}
            {field.required && <span className="ml-0.5 text-red-400">*</span>}
          </span>
        </label>
      </div>
    );
  }

  const inputType =
    field.dataType === 'number'
      ? 'number'
      : field.dataType === 'date'
        ? 'date'
        : field.dataType === 'email'
          ? 'email'
          : 'text';

  return (
    <div className="space-y-1.5">
      {label}
      <input
        id={id}
        type={inputType}
        value={(value as string) ?? ''}
        className={fieldCls}
        onChange={(e) => {
          if (field.dataType === 'number') {
            onChange(field.key, e.target.value === '' ? '' : parseFloat(e.target.value));
          } else {
            onChange(field.key, e.target.value);
          }
        }}
      />
    </div>
  );
}
