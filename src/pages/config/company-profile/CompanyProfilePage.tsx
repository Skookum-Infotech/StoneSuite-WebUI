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
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { fieldCls, fieldErrorCls, textareaCls, textareaErrorCls, fieldLabelCls } from '@/components/crm/formUtils';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';

const DEFAULT_VALUES: CompanyProfileFormValues = {
  companyName: '',
  legalName: '',
  industry: '',
  website: '',
  country: '',
  currency: '',
  timezone: '',
  taxId: '',
  billingAddress: '',
  shippingAddress: '',
  returnAddress: '',
};

// ── Field chrome — icon-prefixed inputs built on the app's actual CRM form
// field classes (components/crm/formUtils, the same ones DynamicFieldInput
// and every CRM/Sales form use) rather than the shadcn Input component, so
// height (h-10) and font size (text-xs, no responsive size jump) match every
// other form screen in the app instead of merely approximating it. ────────

interface FieldSpec {
  id: string;
  label: string;
  icon: LucideIcon;
  placeholder: string;
  required?: boolean;
  fullWidth?: boolean;
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
    <div className={cn('space-y-1.5', field.fullWidth && 'sm:col-span-2')}>
      <label htmlFor={field.id} className={fieldLabelCls}>
        {field.label}
        {field.required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
        <input
          id={field.id}
          type="text"
          placeholder={field.placeholder}
          aria-label={field.label}
          className={cn(error ? fieldErrorCls : fieldCls, 'pl-9')}
          {...registration}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function TextareaField({
  field, registration, error, rows = 3,
}: {
  field: FieldSpec;
  registration: UseFormRegisterReturn;
  error?: string;
  rows?: number;
}) {
  const Icon = field.icon;
  return (
    <div className={cn('space-y-1.5', field.fullWidth && 'sm:col-span-2')}>
      <label htmlFor={field.id} className={fieldLabelCls}>
        {field.label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-3 size-4 text-stone-400" />
        <textarea
          id={field.id}
          rows={rows}
          placeholder={field.placeholder}
          aria-label={field.label}
          className={cn(error ? textareaErrorCls : textareaCls, 'pl-9')}
          {...registration}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// Section card header band — matches BillingDetailsCard / AccountSettingsPage's
// "Profile Information" card exactly (icon-in-box + title + subtitle on a
// tinted band) rather than the plain border-only title this page used before.
function SectionHeader({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/60 px-5 py-4 sm:px-6 sm:py-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/20 text-brand-dark">
        <Icon className="size-4.5" />
      </div>
      <div>
        <h2 className="text-sm font-bold text-stone-900">{title}</h2>
        <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p>
      </div>
    </div>
  );
}

const COMPANY_FIELDS: FieldSpec[] = [
  { id: 'cp-company-name', label: 'Company Name', icon: Building2, placeholder: 'e.g. Acme Stone Co.', required: true, fullWidth: true },
  { id: 'cp-legal-name', label: 'Legal Name', icon: ScrollText, placeholder: 'e.g. Acme Stone Company LLC' },
  { id: 'cp-industry', label: 'Industry', icon: Briefcase, placeholder: 'e.g. Stone Fabrication' },
  { id: 'cp-website', label: 'Website', icon: Globe, placeholder: 'e.g. https://acmestone.com' },
  { id: 'cp-country', label: 'Country', icon: Flag, placeholder: 'e.g. United States' },
  { id: 'cp-currency', label: 'Currency', icon: DollarSign, placeholder: 'e.g. USD' },
  { id: 'cp-timezone', label: 'Timezone', icon: Clock, placeholder: 'e.g. America/Chicago' },
  { id: 'cp-tax-id', label: 'Tax / VAT ID', icon: Receipt, placeholder: 'e.g. 12-3456789', fullWidth: true },
];

const ADDRESS_FIELDS: FieldSpec[] = [
  { id: 'cp-billing-address', label: 'Billing Address', icon: MapPin, placeholder: 'e.g. 123 Main Street, Springfield, IL 62704', fullWidth: true },
  { id: 'cp-shipping-address', label: 'Shipping Address', icon: Truck, placeholder: 'e.g. 456 Warehouse Ave, Springfield, IL 62704' },
  { id: 'cp-return-address', label: 'Return Address', icon: RotateCcw, placeholder: 'e.g. 789 Returns Dock, Springfield, IL 62704' },
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
    'cp-billing-address': 'billingAddress',
    'cp-shipping-address': 'shippingAddress',
    'cp-return-address': 'returnAddress',
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
                {/* Side by side on lg+ so the wide page actually fills up,
                    instead of two cards stacked in a narrow centered column. */}
                {/* No items-start here (default align-items: stretch) so both
                    cards match height on lg+, even though Address Information
                    has fewer fields than Company Information. */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                  <section className="flex h-full flex-col rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
                    <SectionHeader icon={Building2} title="Company Information" subtitle="Your business's identity and details" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 px-5 py-4 sm:px-6 sm:py-5 sm:gap-y-5">
                      {COMPANY_FIELDS.map((field) => (
                        <TextField
                          key={field.id}
                          field={field}
                          registration={register(registerKey[field.id])}
                          error={errors[registerKey[field.id]]?.message}
                        />
                      ))}
                    </div>
                  </section>

                  <section className="flex h-full flex-col rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
                    <SectionHeader icon={MapPin} title="Address Information" subtitle="Where invoices, shipments, and returns are addressed" />
                    <div className="grid flex-1 grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 px-5 py-4 sm:px-6 sm:py-5 sm:gap-y-5">
                      {ADDRESS_FIELDS.map((field) => (
                        <TextareaField
                          key={field.id}
                          field={field}
                          registration={register(registerKey[field.id])}
                          error={errors[registerKey[field.id]]?.message}
                          rows={field.fullWidth ? 4 : 8}
                        />
                      ))}
                    </div>
                  </section>
                </div>

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
