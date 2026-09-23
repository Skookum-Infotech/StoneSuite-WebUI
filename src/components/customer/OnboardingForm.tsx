import { useMemo, useState } from 'react';
import { AlertCircle, Building2, MapPin, Truck, RotateCcw, ShieldCheck, Banknote, Plus, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { onboardingService } from '@/services/tenantServices';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import { PhoneNumberInput } from '@/components/crm/PhoneNumberInput';
import { firstInvalidPhoneLabel } from '@/lib/phoneValidation';
import { defaultCountryName } from '@/lib/lookupDefaults';
import { countryOptions, currencyOptions } from '@/lib/companyInfoLookupOptions';
import { OnboardingSelectField } from './OnboardingSelectField';
import type { FieldDefinition } from '@/types/tenant';
import { cn } from '@/lib/utils';

// 'full' spans both columns inside a section card; default = 1 column.
// 'country'/'currency' render as OnboardingSelectField (lookup-table-backed
// dropdowns) instead of a plain input -- see renderField below.
type BaseField = {
  key: string;
  label: string;
  required?: boolean;
  type?: 'tel' | 'email' | 'url' | 'country' | 'currency';
  full?: boolean;
  placeholder?: string;
};

// Same line1/line2/suite/city/country/state/zip shape as a CRM record's own
// address fields (lib/crmFields.ts) and the tenant's own Company Info page
// (CompanyProfilePage.tsx) — structured, not one free-text blob. Submitted
// as flat prefix_line1/prefix_city/etc. keys (see OnboardingFormData),
// matching what cmd/backfill-company-profile's metadata parser reads back.
// Placeholders mirror CompanyProfileTab.tsx's ADDRESS_SUBFIELDS exactly,
// since both forms feed the same company_profile columns.
function addressFields(prefix: string): BaseField[] {
  return [
    { key: `${prefix}_line1`, label: 'Address Line 1', full: true, placeholder: 'e.g. 123 Main Street' },
    { key: `${prefix}_line2`, label: 'Address Line 2', placeholder: 'e.g. Building B' },
    { key: `${prefix}_suite`, label: 'Suite / Unit #', placeholder: 'e.g. Suite 400' },
    { key: `${prefix}_city`, label: 'City', placeholder: 'e.g. Springfield' },
    { key: `${prefix}_country`, label: 'Country', type: 'country', placeholder: 'Select a country' },
    { key: `${prefix}_state`, label: 'State / Province', placeholder: 'e.g. Illinois' },
    { key: `${prefix}_zip`, label: 'Zip / Postal Code', placeholder: 'e.g. 62704' },
  ];
}

const SECTIONS: { title: string; icon: React.ElementType; fields: BaseField[] }[] = [
  {
    title: 'Company Information',
    icon: Building2,
    // Placeholders for the fields shared with CompanyProfileTab.tsx's
    // COMPANY_FIELDS mirror its wording exactly.
    fields: [
      { key: 'company_name', label: 'Company Name', required: true, full: true, placeholder: 'e.g. Acme Stone Co.' },
      { key: 'legal_name',   label: 'Legal Name', placeholder: 'e.g. Acme Stone Company LLC' },
      { key: 'industry',     label: 'Industry', placeholder: 'e.g. Stone Fabrication' },
      { key: 'website',      label: 'Website',    type: 'url', placeholder: 'e.g. https://acmestone.com' },
      { key: 'country',      label: 'Country', type: 'country', placeholder: 'Select a country' },
      { key: 'currency',     label: 'Currency', type: 'currency', placeholder: 'Select a currency' },
      { key: 'timezone',     label: 'Timezone', placeholder: 'e.g. America/Chicago' },
      { key: 'tax_id',       label: 'Tax / VAT ID', placeholder: 'e.g. 12-3456789' },
    ],
  },
  { title: 'Billing Address', icon: MapPin, fields: addressFields('billing_address') },
  { title: 'Shipping Address', icon: Truck, fields: addressFields('shipping_address') },
  { title: 'Return Address', icon: RotateCcw, fields: addressFields('return_address') },
  {
    title: 'Super Admin Contact',
    icon: ShieldCheck,
    fields: [
      { key: 'super_admin_name',      label: 'Full Name', placeholder: 'e.g. Jordan Lee' },
      { key: 'super_admin_email',     label: 'Email',     required: true, type: 'email', placeholder: 'e.g. jordan@acmestone.com' },
      { key: 'super_admin_phone',     label: 'Phone',     type: 'tel', placeholder: 'e.g. (555) 123-4567' },
      { key: 'super_admin_job_title', label: 'Job Title', placeholder: 'e.g. Owner' },
    ],
  },
  {
    title: 'Finance Contact',
    icon: Banknote,
    fields: [
      { key: 'finance_name',  label: 'Name', placeholder: 'e.g. Taylor Brooks' },
      { key: 'finance_email', label: 'Email', type: 'email', placeholder: 'e.g. billing@acmestone.com' },
      { key: 'finance_phone', label: 'Phone', type: 'tel', placeholder: 'e.g. (555) 123-4567' },
    ],
  },
];

const BASE_KEYS = new Set(SECTIONS.flatMap((s) => s.fields.map((f) => f.key)));
const ALL_BASE_FIELDS = SECTIONS.flatMap((s) => s.fields);

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
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const schemaQ = useQuery({ queryKey: ['onboarding-form-schema'], queryFn: onboardingService.formSchema });
  const extras = useMemo<FieldDefinition[]>(
    () => (schemaQ.data ?? []).filter((f) => !BASE_KEYS.has(f.key)),
    [schemaQ.data],
  );

  // This form runs pre-tenant (no JWT yet), so it can't call the
  // tenant-scoped CRM lookups endpoint the rest of the app uses — it fetches
  // its own public, read-only country list instead.
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
    const badPhone = firstInvalidPhoneLabel(ALL_BASE_FIELDS, formData);
    if (badPhone) { setPhoneError(`Enter a valid phone number for ${badPhone}.`); return; }
    setPhoneError(null);
    onSubmit(formData);
  };

  const str = (k: string) => (typeof formData[k] === 'string' ? (formData[k] as string) : '');
  const bannerMessage = phoneError || errorMessage;

  // One dispatch point per field (tel / country / currency / plain text) so
  // the section grid below stays a simple map -- same shape as
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
          onChange={(v) => set(f.key, v)}
          options={countryOptions(lookupsQ.data?.countries, str(f.key))}
          placeholder={f.placeholder ?? 'Select a country'}
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
