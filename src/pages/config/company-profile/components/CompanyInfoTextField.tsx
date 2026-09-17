import type { UseFormRegisterReturn } from 'react-hook-form';
import type { LucideIcon } from 'lucide-react';
import { fieldCls, fieldErrorCls, fieldLabelCls } from '@/components/crm/formUtils';
import { cn } from '@/lib/utils';

// Icon-prefixed inputs built on the app's actual CRM form field classes
// (components/crm/formUtils, the same ones DynamicFieldInput and every CRM/
// Sales form use) rather than the shadcn Input component, so height (h-10)
// and font size (text-xs, no responsive size jump) match every other form
// screen in the app. Shared by both Company Profile and Locations tabs
// (Configuration -> Company Info) so their address fields render identically.

export interface CompanyInfoFieldSpec {
  id: string;
  label: string;
  icon?: LucideIcon;
  placeholder: string;
  required?: boolean;
  /** How many of the 3 grid columns this field spans on sm+ (default 1) —
   *  for fields that genuinely hold more text (a full street address, a
   *  legal entity name), not applied uniformly. */
  colSpan?: 2 | 3;
}

export function CompanyInfoTextField({
  field, registration, error,
}: {
  field: CompanyInfoFieldSpec;
  registration: UseFormRegisterReturn;
  error?: string;
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
        {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />}
        <input
          id={field.id}
          type="text"
          placeholder={field.placeholder}
          aria-label={field.label}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={cn(error ? fieldErrorCls : fieldCls, Icon && 'pl-9')}
          {...registration}
        />
      </div>
      {error && <p id={errorId} className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
