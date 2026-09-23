import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2, ScrollText, Briefcase, Globe, Flag, DollarSign, Clock, Receipt, AlertCircle, Pencil,
} from 'lucide-react';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { companyProfileService } from '@/services/companyProfileService';
import { companyProfileSchema, type CompanyProfileFormValues } from '@/lib/companyProfileForm';
import type { Address } from '@/types/companyProfile';
import { lookupService } from '@/services/lookupService';
import { countryOptions, currencyOptions, stateOptionsForCountry } from '@/lib/companyInfoLookupOptions';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { CompanyInfoTextField, CompanyInfoReadonlyField, type CompanyInfoFieldSpec } from './CompanyInfoTextField';
import { CompanyInfoSelectField } from './CompanyInfoSelectField';
import { CompanyLogoCard } from './CompanyLogoCard';

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
// Billing/Shipping address sections (lib/crmFields.ts) — one ModernSection
// per address type, matching VendorFormBody/VendorOverviewTab's own section
// layout (a separate bordered card per section, not one big card).
const ADDRESS_GROUPS: { key: 'billingAddress' | 'shippingAddress' | 'returnAddress'; title: string }[] = [
  { key: 'billingAddress', title: 'Billing Address' },
  { key: 'shippingAddress', title: 'Shipping Address' },
  { key: 'returnAddress', title: 'Return Address' },
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

// The COMPANY_FIELDS's plain string fields, as opposed to the *Address
// object fields — narrows registerKey/renderCompanyField's value lookup to
// `string` instead of `string | Address`.
type StringFieldKey = 'companyName' | 'legalName' | 'industry' | 'website' | 'country' | 'currency' | 'timezone' | 'taxId';

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

  const registerKey: Record<string, StringFieldKey> = {
    'cp-company-name': 'companyName',
    'cp-legal-name': 'legalName',
    'cp-industry': 'industry',
    'cp-website': 'website',
    'cp-country': 'country',
    'cp-currency': 'currency',
    'cp-timezone': 'timezone',
    'cp-tax-id': 'taxId',
  };

  // Renders one Company Information field — a read-only box (view mode) or
  // the matching editable input/dropdown (edit mode). Kept as one dispatch
  // point so read/edit mode never drift into two separately-maintained
  // field lists.
  function renderCompanyField(field: CompanyInfoFieldSpec) {
    const key = registerKey[field.id];
    if (!isEditing) {
      return <CompanyInfoReadonlyField key={field.id} field={field} value={values[key] ?? ''} />;
    }
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
        registration={register(key)}
        error={errors[key]?.message}
      />
    );
  }

  // Same dispatch, for one address group's line1/line2/suite/city/country/
  // state/zip sub-fields.
  function renderAddressField(group: (typeof ADDRESS_GROUPS)[number], sub: (typeof ADDRESS_SUBFIELDS)[number]) {
    const fieldSpec = { id: `cp-${group.key}-${sub.key}`, label: sub.label, placeholder: sub.placeholder, colSpan: sub.colSpan };
    const groupValues = values[group.key];
    if (!isEditing) {
      return <CompanyInfoReadonlyField key={sub.key} field={fieldSpec} value={groupValues?.[sub.key] ?? ''} />;
    }
    if (sub.key === 'country') {
      return (
        <CompanyInfoSelectField
          key={sub.key}
          field={fieldSpec}
          registration={register(`${group.key}.country`)}
          error={errors[group.key]?.country?.message}
          options={countryOptions(lookupsQ.data, groupValues?.country ?? '')}
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
          options={stateOptionsForCountry(lookupsQ.data, groupValues?.country ?? '', groupValues?.state ?? '')}
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
  }

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
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="w-full space-y-2">
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

        {/* Separate ModernSection per group (Logo, Company Information, then
            each address) with minimal space between them — same pattern as
            VendorFormBody's edit form / VendorOverviewTab's read-only view,
            rather than one big card. CompanyLogoCard isn't part of this
            react-hook-form instance — its buttons are type="button" and it
            mutates immediately via its own upload/delete endpoints, so
            nesting it inside this <form> doesn't interact with Save/Cancel. */}
        <CompanyLogoCard canConfigure={canConfigure} />

        <ModernSection title="Company Information" index={1}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4">
            {COMPANY_FIELDS.map(renderCompanyField)}
          </div>
        </ModernSection>

        {ADDRESS_GROUPS.map((group, i) => (
          <ModernSection key={group.key} title={group.title} index={i + 2}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4">
              {ADDRESS_SUBFIELDS.map((sub) => renderAddressField(group, sub))}
            </div>
          </ModernSection>
        ))}
      </form>
    </>
  );
}
