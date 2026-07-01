import { useMemo, useState } from 'react';
import { AlertCircle, Building2, MapPin, ShieldCheck, Banknote, Plus, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { onboardingService } from '@/services/tenantServices';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import type { FieldDefinition } from '@/types/tenant';
import { cn } from '@/lib/utils';

// 'full' spans both columns inside a section card; default = 1 column
type BaseField = {
  key: string;
  label: string;
  required?: boolean;
  type?: string;
  textarea?: boolean;
  full?: boolean;
};

const SECTIONS: { title: string; icon: React.ElementType; fields: BaseField[] }[] = [
  {
    title: 'Company Information',
    icon: Building2,
    fields: [
      { key: 'company_name', label: 'Company Name', required: true, full: true },
      { key: 'legal_name',   label: 'Legal Name' },
      { key: 'industry',     label: 'Industry' },
      { key: 'website',      label: 'Website',    type: 'url' },
      { key: 'country',      label: 'Country' },
      { key: 'currency',     label: 'Currency' },
      { key: 'timezone',     label: 'Timezone' },
      { key: 'tax_id',       label: 'Tax / VAT ID' },
    ],
  },
  {
    title: 'Address Information',
    icon: MapPin,
    fields: [
      { key: 'billing_address',  label: 'Billing Address',  textarea: true, full: true },
      { key: 'shipping_address', label: 'Shipping Address', textarea: true },
      { key: 'return_address',   label: 'Return Address',   textarea: true },
    ],
  },
  {
    title: 'Super Admin Contact',
    icon: ShieldCheck,
    fields: [
      { key: 'super_admin_name',      label: 'Full Name' },
      { key: 'super_admin_email',     label: 'Email',     required: true, type: 'email' },
      { key: 'super_admin_phone',     label: 'Phone',     type: 'tel' },
      { key: 'super_admin_job_title', label: 'Job Title' },
    ],
  },
  {
    title: 'Finance Contact',
    icon: Banknote,
    fields: [
      { key: 'finance_name',  label: 'Name' },
      { key: 'finance_email', label: 'Email', type: 'email' },
      { key: 'finance_phone', label: 'Phone', type: 'tel' },
    ],
  },
];

const BASE_KEYS = new Set(SECTIONS.flatMap((s) => s.fields.map((f) => f.key)));

const inputCls =
  'w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 outline-none placeholder:text-stone-300 focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20 transition disabled:bg-stone-100 disabled:text-stone-400';

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="size-4 mt-0.5 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      {/* ── 2×2 section grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.title}
              className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden flex flex-col"
            >
              {/* Section header */}
              <div className="flex items-center gap-3 border-b border-stone-100 px-5 py-3.5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                  <Icon className="size-3.5 text-brand-dark" />
                </div>
                <h3 className="text-sm font-bold text-stone-800">{section.title}</h3>
              </div>

              {/* Fields — 2-col grid inside each card */}
              <div className="flex-1 px-5 py-4 grid grid-cols-2 gap-x-4 gap-y-3.5 content-start">
                {section.fields.map((f) => (
                  <div key={f.key} className={cn(f.full ? 'col-span-2' : 'col-span-1')}>
                    <label className="mb-1 block text-xs font-semibold text-stone-500">
                      {f.label}
                      {f.required && <span className="ml-0.5 text-red-500">*</span>}
                    </label>
                    {f.textarea ? (
                      <textarea
                        name={f.key}
                        rows={f.full ? 3 : 4}
                        required={f.required}
                        value={str(f.key)}
                        onChange={(e) => set(f.key, e.target.value)}
                        className={cn(inputCls, 'resize-none')}
                      />
                    ) : (
                      <input
                        name={f.key}
                        type={f.type ?? 'text'}
                        required={f.required}
                        value={str(f.key)}
                        onChange={(e) => set(f.key, e.target.value)}
                        className={inputCls}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Extra dynamic fields */}
      {extras.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 border-b border-stone-100 px-5 py-3.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand/10">
              <Plus className="size-3.5 text-brand-dark" />
            </div>
            <h3 className="text-sm font-bold text-stone-800">Additional Information</h3>
          </div>
          <div className="px-5 py-4 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3.5">
            {extras.map((f) => (
              <div key={f.id || f.key} className="col-span-1 lg:col-span-2">
                <DynamicFieldInput field={f} value={data[f.key]} onChange={set} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end pb-6">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-stone-950 hover:bg-brand/80 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {submitting ? 'Submitting…' : 'Submit application'}
          {!submitting && <ArrowRight className="size-4" />}
        </button>
      </div>
    </form>
  );
}
