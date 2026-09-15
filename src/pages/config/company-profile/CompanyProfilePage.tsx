import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { Resolver, UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2, MapPin, ScrollText, Briefcase, Globe, Flag, DollarSign, Clock,
  Receipt, Truck, RotateCcw, AlertCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { companyProfileService } from '@/services/companyProfileService';
import { companyProfileSchema, type CompanyProfileFormValues } from '@/lib/companyProfileForm';
import type { Address } from '@/types/companyProfile';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { fieldCls, fieldErrorCls, fieldLabelCls } from '@/components/crm/formUtils';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';

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

// ── Field chrome — icon-prefixed inputs built on the app's actual CRM form
// field classes (components/crm/formUtils, the same ones DynamicFieldInput
// and every CRM/Sales form use) rather than the shadcn Input component, so
// height (h-10) and font size (text-xs, no responsive size jump) match every
// other form screen in the app instead of merely approximating it. Icon is
// optional: the top-level company fields get one, the address line1/line2/
// suite/city/country/state/zip fields don't — matching how CRM's own address
// fields (lib/crmFields.ts) render, plain labeled inputs with no icon. ────

interface FieldSpec {
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

function TextField({
  field, registration, error,
}: {
  field: FieldSpec;
  registration: UseFormRegisterReturn;
  error?: string;
}) {
  const Icon = field.icon;
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
          className={cn(error ? fieldErrorCls : fieldCls, Icon && 'pl-9')}
          {...registration}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// Spans chosen by how much text each field typically holds, not uniformly:
// Company Name gets the full row, Legal Name/Website (often longer than
// their neighbors) get 2 of 3 columns, everything else is a single column —
// tiling into clean 3-wide rows (3, then 2+1, then 2+1, then 1+1+1).
const COMPANY_FIELDS: FieldSpec[] = [
  { id: 'cp-company-name', label: 'Company Name', icon: Building2, placeholder: 'e.g. Acme Stone Co.', required: true, colSpan: 3 },
  { id: 'cp-legal-name', label: 'Legal Name', icon: ScrollText, placeholder: 'e.g. Acme Stone Company LLC', colSpan: 2 },
  { id: 'cp-industry', label: 'Industry', icon: Briefcase, placeholder: 'e.g. Stone Fabrication' },
  { id: 'cp-website', label: 'Website', icon: Globe, placeholder: 'e.g. https://acmestone.com', colSpan: 2 },
  { id: 'cp-country', label: 'Country', icon: Flag, placeholder: 'e.g. United States' },
  { id: 'cp-currency', label: 'Currency', icon: DollarSign, placeholder: 'e.g. USD' },
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
const ADDRESS_SUBFIELDS: { key: keyof Address; label: string; placeholder: string; colSpan?: 2 | 3 }[] = [
  { key: 'line1', label: 'Address Line 1', placeholder: 'e.g. 123 Main Street', colSpan: 3 },
  { key: 'line2', label: 'Address Line 2', placeholder: 'e.g. Building B' },
  { key: 'suite', label: 'Suite / Unit #', placeholder: 'e.g. Suite 400' },
  { key: 'city', label: 'City', placeholder: 'e.g. Springfield' },
  { key: 'country', label: 'Country', placeholder: 'e.g. United States' },
  { key: 'state', label: 'State / Province', placeholder: 'e.g. IL' },
  { key: 'zip', label: 'Zip / Postal Code', placeholder: 'e.g. 62704' },
];

export default function CompanyProfilePage() {
  const qc = useQueryClient();
  const { hasPermission } = useUserPermissions();
  const canConfigure = hasPermission('company_profile', 'configure');

  const profileQ = useQuery({
    queryKey: ['company-profile'],
    queryFn: companyProfileService.get,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CompanyProfileFormValues>({
    resolver: zodResolver(companyProfileSchema) as unknown as Resolver<CompanyProfileFormValues>,
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (profileQ.data) reset(profileQ.data);
  }, [profileQ.data, reset]);

  const save = useMutation({
    mutationFn: (data: CompanyProfileFormValues) => companyProfileService.update(data),
    onSuccess: (saved) => {
      qc.setQueryData(['company-profile'], saved);
      reset(saved);
      toast.success('Company info saved');
    },
  });

  function onSubmit(data: CompanyProfileFormValues) {
    save.mutate(data);
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

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-stone-50/60">
      {/* Page header */}
      <div className="bg-background border-b border-stone-200 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/15 text-brand-dark">
            <Building2 className="size-6" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">Company Info</h1>
            <p className="text-sm text-stone-500 mt-0.5">
              Your company&apos;s own name and address — not a customer&apos;s or vendor&apos;s.
            </p>
          </div>
        </div>
      </div>

      {/* Body — same centered, responsively-capped wrapper as the other
          Config settings pages (SAML Setup, Roles): mx-auto keeps whitespace
          balanced on both sides instead of pinning content to the left edge. */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-[1500px] 3xl:max-w-[1800px] 4xl:max-w-full px-6 py-6">
          {profileQ.isLoading && (
            <div className="flex items-center justify-center h-40">
              <Spinner label="Loading company info…" />
            </div>
          )}
          {profileQ.isError && (
            <div className="max-w-lg">
              <ErrorNote>{apiErrorMessage(profileQ.error)}</ErrorNote>
            </div>
          )}

          {!profileQ.isLoading && !profileQ.isError && (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="w-full space-y-4 sm:space-y-5">
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

              <fieldset disabled={!canConfigure} className="space-y-4 sm:space-y-5">
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
                        {COMPANY_FIELDS.map((field) => (
                          <TextField
                            key={field.id}
                            field={field}
                            registration={register(registerKey[field.id])}
                            error={errors[registerKey[field.id]]?.message}
                          />
                        ))}
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
                            {ADDRESS_SUBFIELDS.map((sub) => (
                              <TextField
                                key={sub.key}
                                field={{
                                  id: `cp-${group.key}-${sub.key}`,
                                  label: sub.label,
                                  placeholder: sub.placeholder,
                                  colSpan: sub.colSpan,
                                }}
                                registration={register(`${group.key}.${sub.key}`)}
                                error={errors[group.key]?.[sub.key]?.message}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <div className="flex justify-end pb-6">
                  <button
                    type="submit"
                    disabled={isSubmitting || save.isPending || !isDirty || !canConfigure}
                    aria-label="Save company info"
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-stone-950 hover:bg-brand/80 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {save.isPending ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </fieldset>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
