import { useMemo, useState } from 'react';
import { AlertCircle, Plus, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { onboardingService } from '@/services/tenantServices';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import { PhoneNumberInput } from '@/components/crm/PhoneNumberInput';
import { firstInvalidPhoneLabel } from '@/lib/phoneValidation';
import { defaultCountryName } from '@/lib/lookupDefaults';
import { countryOptions, currencyOptions, stateOptionsForCountry } from '@/lib/companyInfoLookupOptions';
import { OnboardingSelectField } from './OnboardingSelectField';
import {
  ALL_BASE_FIELDS,
  BASE_KEYS,
  SECTIONS,
  missingRequiredLabels,
  type BaseField,
} from './onboardingFormFields';
import type { FieldDefinition } from '@/types/tenant';
import { cn } from '@/lib/utils';

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
  // New applications default currency to USD. The spread order lets
  // `prefill` (e.g. a saved draft) override this when present.
  const [data, setData] = useState<Record<string, unknown>>(() => ({
    currency: 'USD',
    ...(prefill ?? {}),
  }));
  const set = (key: string, value: unknown) => setData((d) => ({ ...d, [key]: value }));
  const [validationError, setValidationError] = useState<string | null>(null);

  const schemaQ = useQuery({ queryKey: ['onboarding-form-schema'], queryFn: onboardingService.formSchema });
  const extras = useMemo<FieldDefinition[]>(
    () => (schemaQ.data ?? []).filter((f) => !BASE_KEYS.has(f.key)),
    [schemaQ.data],
  );

  // This form runs pre-tenant (no JWT yet), so it can't call the
  // tenant-scoped CRM lookups endpoint the rest of the app uses — it fetches
  // its own public, read-only country/state/currency lists instead.
  const lookupsQ = useQuery({
    queryKey: ['onboarding-lookups'],
    queryFn: onboardingService.lookups,
    staleTime: 10 * 60 * 1000,
  });

  // Country defaults to the live lookup table's own wording once it loads —
  // derived rather than copied into state (same pattern as
  // AddSalesOrderPage.tsx's bill_country/ship_country), so it never clobbers
  // a value the applicant (or a saved draft) already set, and falls back to
  // the static mirror while the fetch is pending or if it fails.
  const formData = useMemo<Record<string, unknown>>(
    () => ({
      ...data,
      country: (typeof data.country === 'string' && data.country) || defaultCountryName(lookupsQ.data?.countries),
    }),
    [data, lookupsQ.data],
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const missing = missingRequiredLabels(formData);
    if (missing.length > 0) { setValidationError(`Please fill in the required fields: ${missing.join(', ')}.`); return; }
    const badPhone = firstInvalidPhoneLabel(ALL_BASE_FIELDS, formData);
    if (badPhone) { setValidationError(`Enter a valid phone number for ${badPhone}.`); return; }
    setValidationError(null);
    onSubmit(formData);
  };

  const str = (k: string) => (typeof formData[k] === 'string' ? (formData[k] as string) : '');
  const bannerMessage = validationError || errorMessage;

  // One dispatch point per field (tel / country / state / currency / plain
  // text) so the section grid below stays a simple map -- same shape as
  // CompanyProfileTab.tsx's renderCompanyField/renderAddressField.
  function renderField(f: BaseField) {
    if (f.type === 'tel') {
      return (
        <PhoneNumberInput
          value={str(f.key)}
          onChange={(v) => set(f.key, v)}
          required={f.required}
          placeholder={f.placeholder}
          className={inputCls}
          aria-label={f.label}
        />
      );
    }
    if (f.type === 'country') {
      return (
        <OnboardingSelectField
          label={f.label}
          value={str(f.key)}
          onChange={(v) => {
            // A state belongs to one country: picking a different country
            // drops the stale state instead of leaving it behind as "(current)".
            if (f.stateKey && v !== str(f.key)) set(f.stateKey, '');
            set(f.key, v);
          }}
          options={countryOptions(lookupsQ.data?.countries, str(f.key))}
          placeholder={f.placeholder ?? 'Select a country'}
          className={inputCls}
        />
      );
    }
    if (f.type === 'state') {
      return (
        <OnboardingSelectField
          label={f.label}
          value={str(f.key)}
          onChange={(v) => set(f.key, v)}
          options={stateOptionsForCountry(lookupsQ.data, f.countryKey ? str(f.countryKey) : '', str(f.key))}
          placeholder={f.placeholder ?? 'Select a state'}
          className={inputCls}
        />
      );
    }
    if (f.type === 'currency') {
      return (
        <OnboardingSelectField
          label={f.label}
          value={str(f.key)}
          onChange={(v) => set(f.key, v)}
          options={currencyOptions(lookupsQ.data?.currencies, str(f.key))}
          placeholder={f.placeholder ?? 'Select a currency'}
          className={inputCls}
        />
      );
    }
    return (
      <input
        name={f.key}
        type={f.type ?? 'text'}
        required={f.required}
        placeholder={f.placeholder}
        value={str(f.key)}
        onChange={(e) => set(f.key, e.target.value)}
        className={inputCls}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {bannerMessage && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="size-4 mt-0.5 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{bannerMessage}</p>
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
                    {renderField(f)}
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
                <DynamicFieldInput field={f} value={formData[f.key]} onChange={set} />
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
