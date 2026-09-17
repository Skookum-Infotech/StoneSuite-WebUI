import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2, MapPin, ScrollText, Briefcase, Globe, Flag, DollarSign, Clock,
  Receipt, Truck, RotateCcw, AlertCircle, Pencil,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { companyProfileService } from '@/services/companyProfileService';
import { companyProfileSchema, type CompanyProfileFormValues } from '@/lib/companyProfileForm';
import type { Address } from '@/types/companyProfile';
import { lookupService } from '@/services/lookupService';
import { countryOptions, currencyOptions, stateOptionsForCountry } from '@/lib/companyInfoLookupOptions';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { CompanyInfoTextField, type CompanyInfoFieldSpec } from './CompanyInfoTextField';
import { CompanyInfoSelectField } from './CompanyInfoSelectField';

const EMPTY_ADDRESS: Address = { line1: '', line2: '', suite: '', city: '', country: '', state: '', zip: '' };

const DEFAULT_VALUES: CompanyProfileFormValues = {
  companyName: '',
  legalName: '',
  industry: '',
  website: '',
  country: '',
  currency: '',
  timezone: '',
  taxId: '',
  billingAddress: EMPTY_ADDRESS,
  shippingAddress: EMPTY_ADDRESS,
  returnAddress: EMPTY_ADDRESS,
};

// Spans chosen by how much text each field typically holds, not uniformly:
// Company Name gets the full row, Legal Name/Website (often longer than
// their neighbors) get 2 of 3 columns, everything else is a single column —
// tiling into clean 3-wide rows (3, then 2+1, then 2+1, then 1+1+1).
// Country/Currency render as CompanyInfoSelectField (backend-lookup-backed
// dropdowns, see the id special-cases below) — Industry/Timezone stay plain
// text since no backend lookup exists for either.
const COMPANY_FIELDS: CompanyInfoFieldSpec[] = [
  { id: 'cp-company-name', label: 'Company Name', icon: Building2, placeholder: 'e.g. Acme Stone Co.', required: true, colSpan: 3 },
  { id: 'cp-legal-name', label: 'Legal Name', icon: ScrollText, placeholder: 'e.g. Acme Stone Company LLC', colSpan: 2 },
  { id: 'cp-industry', label: 'Industry', icon: Briefcase, placeholder: 'e.g. Stone Fabrication' },
  { id: 'cp-website', label: 'Website', icon: Globe, placeholder: 'e.g. https://acmestone.com', colSpan: 2 },
  { id: 'cp-country', label: 'Country', icon: Flag, placeholder: 'Select a country' },
  { id: 'cp-currency', label: 'Currency', icon: DollarSign, placeholder: 'Select a currency' },
  { id: 'cp-timezone', label: 'Timezone', icon: Clock, placeholder: 'e.g. America/Chicago' },
  { id: 'cp-tax-id', label: 'Tax / VAT ID', icon: Receipt, placeholder: 'e.g. 12-3456789' },
];

// Same line1/line2/suite/city/country/state/zip shape as a CRM record's own
// Billing/Shipping address sections (lib/crmFields.ts) — one group per
// address type, each rendered as its own labeled block within the card.
const ADDRESS_GROUPS: { key: 'billingAddress' | 'shippingAddress' | 'returnAddress'; title: string; icon: LucideIcon }[] = [
  { key: 'billingAddress', title: 'Billing Address', icon: MapPin },
  { key: 'shippingAddress', title: 'Shipping Address', icon: Truck },
  { key: 'returnAddress', title: 'Return Address', icon: RotateCcw },
];

// Line 1 gets the full row (a street address needs the room); line2/suite/
// city then tile 3-across, and country/state/zip tile 3-across below that.
// country/state render as dropdowns (see the key special-cases below).
const ADDRESS_SUBFIELDS: { key: keyof Address; label: string; placeholder: string; colSpan?: 2 | 3 }[] = [
  { key: 'line1', label: 'Address Line 1', placeholder: 'e.g. 123 Main Street', colSpan: 3 },
  { key: 'line2', label: 'Address Line 2', placeholder: 'e.g. Building B' },
  { key: 'suite', label: 'Suite / Unit #', placeholder: 'e.g. Suite 400' },
  { key: 'city', label: 'City', placeholder: 'e.g. Springfield' },
  { key: 'country', label: 'Country', placeholder: 'Select a country' },
  { key: 'state', label: 'State / Province', placeholder: 'Select a state' },
  { key: 'zip', label: 'Zip / Postal Code', placeholder: 'e.g. 62704' },
];

const FORM_ID = 'company-profile-form';

export function CompanyProfileTab({ actionsSlot }: { actionsSlot: HTMLDivElement | null }) {
  const qc = useQueryClient();
  const { hasPermission } = useUserPermissions();
  const canConfigure = hasPermission('company_profile', 'configure');
  const [isEditing, setIsEditing] = useState(false);

  const profileQ = useQuery({
    queryKey: ['company-profile'],
    queryFn: companyProfileService.get,
  });
  // Same lookup list Purchase Order's Ship To uses (lib/purchaseOrderForm.ts)
  // — here only for curated dropdown values, not FK ids (see
  // lib/companyInfoLookupOptions.ts for why the two forms differ).
  const lookupsQ = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CompanyProfileFormValues>({
    resolver: zodResolver(companyProfileSchema) as unknown as Resolver<CompanyProfileFormValues>,
    defaultValues: DEFAULT_VALUES,
  });
  const values = watch();

  useEffect(() => {
    if (profileQ.data) reset(profileQ.data);
  }, [profileQ.data, reset]);

  const save = useMutation({
    mutationFn: (data: CompanyProfileFormValues) => companyProfileService.update(data),
    onSuccess: (saved) => {
      qc.setQueryData(['company-profile'], saved);
      reset(saved);
      setIsEditing(false);
      toast.success('Company info saved');
    },
  });

  function onSubmit(data: CompanyProfileFormValues) {
    save.mutate(data);
  }

  function cancelEdit() {
    reset(profileQ.data ?? DEFAULT_VALUES);
    setIsEditing(false);
  }

  const registerKey: Record<string, keyof CompanyProfileFormValues> = {
    'cp-company-name': 'companyName',
    'cp-legal-name': 'legalName',
    'cp-industry': 'industry',
    'cp-website': 'website',
    'cp-country': 'country',
    'cp-currency': 'currency',
    'cp-timezone': 'timezone',
    'cp-tax-id': 'taxId',
  };

  if (profileQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Spinner label="Loading company info…" />
      </div>
    );
  }
  if (profileQ.isError) {
    return (
      <div className="max-w-lg">
        <ErrorNote>{apiErrorMessage(profileQ.error)}</ErrorNote>
      </div>
    );
  }

  // Portaled into the page header's actions slot (CompanyProfilePage.tsx)
  // rather than rendered in place. The Save button lives outside the <form>
  // DOM node once portaled, so it's associated back to it via the
  // form="..." attribute rather than relying on native nesting. Sizing
  // matches the app's standard "New X" header button (e.g.
  // VendorBillListPage) so it reads the same as every other page's primary
  // header action.
  const actions = canConfigure && (
    !isEditing ? (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        aria-label="Edit company info"
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-2 px-4 text-sm font-semibold shadow-sm transition hover:bg-brand-hover active:scale-95"
      >
        <Pencil className="size-3.5" />
        Edit
      </button>
    ) : (
      <>
        <button
          type="button"
          onClick={cancelEdit}
          disabled={isSubmitting || save.isPending}
          aria-label="Cancel editing company info"
          className="inline-flex items-center justify-center rounded-lg py-2 px-4 text-sm font-semibold text-stone-600 hover:bg-stone-100 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          form={FORM_ID}
          disabled={isSubmitting || save.isPending || !isDirty}
          aria-label="Save company info"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-2 px-4 text-sm font-semibold shadow-sm transition hover:bg-brand-hover active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </>
    )
  );

  return (
    <>
      {actionsSlot && createPortal(actions, actionsSlot)}
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="w-full space-y-4 sm:space-y-5">
        {save.isError && (
          <ErrorNote>{apiErrorMessage(save.error, 'Could not save company info.')}</ErrorNote>
        )}

        {!canConfigure && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3.5">
            <AlertCircle className="size-4 shrink-0 text-amber-500 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-800">View-only access</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Ask an admin for the Company Info: Configure permission to make changes.
              </p>
            </div>
          </div>
        )}

      <fieldset disabled={!canConfigure || !isEditing} className="space-y-4 sm:space-y-5">
        {/* One full-width card (not two side by side) — every group
            (Company Information, then each address) is a labeled
            block inside it, each tiling its fields 3 across on sm+. */}
        <section className="w-full rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="divide-y divide-stone-100">
            <div className="px-5 py-4 sm:px-6 sm:py-5">
              <h3 className="mb-3 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-stone-400">
                <Building2 className="size-3.5" />
                Company Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4">
                {COMPANY_FIELDS.map((field) => {
                  if (field.id === 'cp-country') {
                    return (
                      <CompanyInfoSelectField
                        key={field.id}
                        field={field}
                        registration={register('country')}
                        error={errors.country?.message}
                        options={countryOptions(lookupsQ.data, values.country ?? '')}
                      />
                    );
                  }
                  if (field.id === 'cp-currency') {
                    return (
                      <CompanyInfoSelectField
                        key={field.id}
                        field={field}
                        registration={register('currency')}
                        error={errors.currency?.message}
                        options={currencyOptions(lookupsQ.data, values.currency ?? '')}
                      />
                    );
                  }
                  return (
                    <CompanyInfoTextField
                      key={field.id}
                      field={field}
                      registration={register(registerKey[field.id])}
                      error={errors[registerKey[field.id]]?.message}
                    />
                  );
                })}
              </div>
            </div>

            {ADDRESS_GROUPS.map((group) => {
              const GroupIcon = group.icon;
              return (
                <div key={group.key} className="px-5 py-4 sm:px-6 sm:py-5">
                  <h3 className="mb-3 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-stone-400">
                    <GroupIcon className="size-3.5" />
                    {group.title}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4">
                    {ADDRESS_SUBFIELDS.map((sub) => {
                      const fieldSpec = {
                        id: `cp-${group.key}-${sub.key}`,
                        label: sub.label,
                        placeholder: sub.placeholder,
                        colSpan: sub.colSpan,
                      };
                      if (sub.key === 'country') {
                        return (
                          <CompanyInfoSelectField
                            key={sub.key}
                            field={fieldSpec}
                            registration={register(`${group.key}.country`)}
                            error={errors[group.key]?.country?.message}
                            options={countryOptions(lookupsQ.data, values[group.key]?.country ?? '')}
                          />
                        );
                      }
                      if (sub.key === 'state') {
                        return (
                          <CompanyInfoSelectField
                            key={sub.key}
                            field={fieldSpec}
                            registration={register(`${group.key}.state`)}
                            error={errors[group.key]?.state?.message}
                            options={stateOptionsForCountry(
                              lookupsQ.data,
                              values[group.key]?.country ?? '',
                              values[group.key]?.state ?? '',
                            )}
                          />
                        );
                      }
                      return (
                        <CompanyInfoTextField
                          key={sub.key}
                          field={fieldSpec}
                          registration={register(`${group.key}.${sub.key}`)}
                          error={errors[group.key]?.[sub.key]?.message}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </fieldset>
      </form>
    </>
  );
}
