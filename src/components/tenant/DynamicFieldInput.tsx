import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    <Label htmlFor={id} className="flex items-center gap-1">
      {labelText}
      {field.required && <span className="text-red-500">*</span>}
    </Label>
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
          className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none focus-visible:border-stone-400 dark:border-stone-700 dark:bg-stone-900"
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
      <div className="flex items-center gap-2 pt-6">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(field.key, e.target.checked)}
          className="size-4 rounded border-stone-300"
        />
        <Label htmlFor={id}>{labelText}</Label>
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
      <Input
        id={id}
        type={inputType}
        value={(value as string) ?? ''}
        onChange={(e) => {
          if (field.dataType === 'number') {
            onChange(field.key, e.target.value === '' ? '' : parseFloat(e.target.value));
          } else {
            onChange(field.key, e.target.value);
          }
        }}
        // placeholder={labelText}
      />
    </div>
  );
}
