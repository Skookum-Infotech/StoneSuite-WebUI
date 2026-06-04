import { useMemo, useState } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { onboardingService } from '@/services/tenantServices';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import type { FieldDefinition } from '@/types/tenant';

// Structured base sections (keys are the Customer-workflow field keys). Any
// field the owner adds to the Customer workflow that is NOT one of these keys
// renders below as a dynamic extra — so the form stays in sync, no hardcoding.
type BaseField = { key: string; label: string; required?: boolean; type?: string; textarea?: boolean };
const SECTIONS: { title: string; fields: BaseField[] }[] = [
  {
    title: 'Company Information',
    fields: [
      { key: 'company_name', label: 'Company Name', required: true },
      { key: 'legal_name', label: 'Legal Name' },
      { key: 'industry', label: 'Industry' },
      { key: 'website', label: 'Website', type: 'url' },
      { key: 'country', label: 'Country' },
      { key: 'currency', label: 'Currency' },
      { key: 'timezone', label: 'Timezone' },
      { key: 'tax_id', label: 'Tax / VAT ID or EIN' },
    ],
  },
  {
    title: 'Address Information',
    fields: [
      { key: 'billing_address', label: 'Billing Address', textarea: true },
      { key: 'shipping_address', label: 'Shipping Address', textarea: true },
      { key: 'return_address', label: 'Return Address', textarea: true },
    ],
  },
  {
    title: 'Super Admin Contact',
    fields: [
      { key: 'super_admin_name', label: 'Full Name' },
      { key: 'super_admin_email', label: 'Email', required: true, type: 'email' },
      { key: 'super_admin_phone', label: 'Phone', type: 'tel' },
      { key: 'super_admin_job_title', label: 'Job Title' },
    ],
  },
  {
    title: 'Finance Contact',
    fields: [
      { key: 'finance_name', label: 'Name' },
      { key: 'finance_email', label: 'Email', type: 'email' },
      { key: 'finance_phone', label: 'Phone', type: 'tel' },
    ],
  },
];

const BASE_KEYS = new Set(SECTIONS.flatMap((s) => s.fields.map((f) => f.key)));

const inputClass =
  'w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-800 outline-none placeholder:text-stone-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition';

export function OnboardingForm({
  prefill,
  submitting,
  errorMessage,
  onSubmit,
}: {
  prefill?: Record<string, unknown>;
  submitting: boolean;
  errorMessage?: string | null;
  onSubmit: (formData: Record<string, unknown>) => void;
}) {
  const [data, setData] = useState<Record<string, unknown>>(() => ({ ...(prefill ?? {}) }));
  const set = (key: string, value: unknown) => setData((d) => ({ ...d, [key]: value }));

  // Dynamic extras: Customer-workflow fields that aren't part of the base layout.
  const schemaQ = useQuery({ queryKey: ['onboarding-form-schema'], queryFn: onboardingService.formSchema });
  const extras = useMemo<FieldDefinition[]>(
    () => (schemaQ.data ?? []).filter((f) => !BASE_KEYS.has(f.key)),
    [schemaQ.data],
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(data);
  };

  const str = (k: string) => (typeof data[k] === 'string' ? (data[k] as string) : '');

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {errorMessage && (
        <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2.5">
          <AlertCircle className="size-3.5 mt-0.5 shrink-0 text-red-500" />
          <p className="text-xs text-red-700">{errorMessage}</p>
        </div>
      )}

      {SECTIONS.map((section) => (
        <Section key={section.title} title={section.title}>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
            {section.fields.map((f) => (
              <Field key={f.key} label={f.label} required={f.required}>
                {f.textarea ? (
                  <textarea
                    name={f.key}
                    rows={3}
                    required={f.required}
                    value={str(f.key)}
                    onChange={(e) => set(f.key, e.target.value)}
                    className={`${inputClass} resize-none`}
                  />
                ) : (
                  <input
                    name={f.key}
                    type={f.type ?? 'text'}
                    required={f.required}
                    value={str(f.key)}
                    onChange={(e) => set(f.key, e.target.value)}
                    className={inputClass}
                  />
                )}
              </Field>
            ))}
          </div>
        </Section>
      ))}

      {extras.length > 0 && (
        <Section title="Additional Information">
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {extras.map((f) => (
              <DynamicFieldInput key={f.id || f.key} field={f} value={data[f.key]} onChange={set} />
            ))}
          </div>
        </Section>
      )}

      <div className="pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-1 rounded bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded border border-stone-200 bg-white">
      <div className="flex items-center gap-2 border-b border-stone-200 bg-blue-50 px-4 py-2">
        <ChevronDown className="size-3 text-stone-400" />
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-stone-700">{title}</h3>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-semibold uppercase tracking-wide text-stone-500">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
