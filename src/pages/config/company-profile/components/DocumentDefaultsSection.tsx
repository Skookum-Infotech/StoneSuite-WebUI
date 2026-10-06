import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { fieldCls, fieldErrorCls, fieldLabelCls, readonlyCls } from '@/components/crm/formUtils';
import type { CompanyProfileFormValues } from '@/lib/companyProfileForm';
import type { DocumentDefaultKind, DocumentWording } from '@/types/companyProfile';
import { cn } from '@/lib/utils';

const DOCUMENT_TYPES: { kind: DocumentDefaultKind; label: string }[] = [
  { kind: 'estimate', label: 'Estimate' },
  { kind: 'quote', label: 'Quote' },
  { kind: 'sales_order', label: 'Sales Order' },
  { kind: 'invoice', label: 'Invoice' },
];

const WORDING_FIELDS: { key: keyof DocumentWording; label: string; placeholder: string }[] = [
  { key: 'terms', label: 'Terms & Conditions', placeholder: 'e.g. Payment is due within 30 days of the invoice date.' },
  { key: 'notes', label: 'Notes', placeholder: 'e.g. Thank you for your business.' },
];

// Configuration -> Company Info -> Document Defaults: the Terms & Conditions and
// Notes printed on a PDF whose record leaves them blank. A document's own text
// always wins; with no default set the PDF simply omits the section.
export function DocumentDefaultsSection({
  index, isEditing, values, register, errors,
}: {
  index: number;
  isEditing: boolean;
  values: CompanyProfileFormValues;
  register: UseFormRegister<CompanyProfileFormValues>;
  errors: FieldErrors<CompanyProfileFormValues>;
}) {
  return (
    <ModernSection title="Document Defaults" index={index}>
      <p className="mb-4 text-xs text-stone-500">
        Printed on a PDF when the document's own Terms &amp; Conditions or Notes are blank. Leave empty to print nothing.
      </p>
      <div className="space-y-6">
        {DOCUMENT_TYPES.map(({ kind, label }) => (
          <div key={kind} className="space-y-3">
            <h4 className="text-xs font-semibold text-stone-700">{label}</h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-4">
              {WORDING_FIELDS.map(({ key, label: fieldLabel, placeholder }) => {
                const id = `cp-default-${kind}-${key}`;
                const error = errors.documentDefaults?.[kind]?.[key]?.message;
                const errorId = `${id}-error`;
                return (
                  <div key={id} className="space-y-1.5">
                    <label htmlFor={isEditing ? id : undefined} className={fieldLabelCls}>{fieldLabel}</label>
                    {isEditing ? (
                      <textarea
                        id={id}
                        rows={4}
                        placeholder={placeholder}
                        aria-label={`${label} ${fieldLabel}`}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? errorId : undefined}
                        className={cn(error ? fieldErrorCls : fieldCls, 'h-auto py-2')}
                        {...register(`documentDefaults.${kind}.${key}`)}
                      />
                    ) : (
                      <div className={cn(readonlyCls, 'h-auto min-h-10 whitespace-pre-wrap')}>
                        {values.documentDefaults?.[kind]?.[key] || <span className="text-stone-400">—</span>}
                      </div>
                    )}
                    {error && <p id={errorId} className="mt-1 text-xs text-red-600">{error}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ModernSection>
  );
}
