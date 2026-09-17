import type { UseFormRegisterReturn } from 'react-hook-form';
import { fieldCls, fieldErrorCls, fieldLabelCls } from '@/components/crm/formUtils';
import { cn } from '@/lib/utils';
import type { CompanyInfoFieldSpec } from './CompanyInfoTextField';
import type { SelectOption } from '@/lib/companyInfoLookupOptions';

// Dropdown counterpart to CompanyInfoTextField, same chrome/sizing — for the
// handful of Company Info fields (country/state/currency) that have a
// backend lookup list to choose from, even though the value saved is still
// plain text (see lib/companyInfoLookupOptions.ts).
export function CompanyInfoSelectField({
  field, registration, error, options,
}: {
  field: CompanyInfoFieldSpec;
  registration: UseFormRegisterReturn;
  error?: string;
  options: SelectOption[];
}) {
  const Icon = field.icon;
  const errorId = `${field.id}-error`;
  return (
    <div className={cn(
      'space-y-1.5',
      field.colSpan === 3 && 'sm:col-span-2 lg:col-span-3',
      field.colSpan === 2 && 'lg:col-span-2',
    )}>
      <label htmlFor={field.id} className={fieldLabelCls}>
        {field.label}
        {field.required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400 z-10" />}
        <select
          id={field.id}
          aria-label={field.label}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={cn(error ? fieldErrorCls : fieldCls, Icon && 'pl-9')}
          {...registration}
        >
          <option value="">{field.placeholder}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {error && <p id={errorId} className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
