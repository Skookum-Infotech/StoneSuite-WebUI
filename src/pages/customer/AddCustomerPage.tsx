import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, AlertCircle, CheckCircle2, Copy } from 'lucide-react';
import { platformService, type OnboardCustomerPayload } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import type { CreateTenantResult } from '@/types/tenant';

export default function AddCustomerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<CreateTenantResult | null>(null);
  const [copied, setCopied] = useState(false);

  const { mutate: onboard, isPending, error } = useMutation({
    // Provisions an isolated tenant DB (seeded with default workflows + roles)
    // and generates an onboarding invite link for the customer's super admin.
    mutationFn: (payload: OnboardCustomerPayload) => platformService.createTenant(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setResult(res);
    },
  });

  const errorMessage = error ? apiErrorMessage(error, 'Onboarding failed.') : null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const get = (key: string) => String(form.get(key) ?? '').trim();

    onboard({
      companyName: get('companyName'),
      legalName: get('legalName'),
      industry: get('industry'),
      website: get('website'),
      country: get('country'),
      currency: get('currency'),
      timezone: get('timezone'),
      taxId: get('taxId'),
      billingAddress: get('billingAddress'),
      shippingAddress: get('shippingAddress'),
      returnAddress: get('returnAddress'),
      superAdminName: get('superAdminName'),
      superAdminEmail: get('superAdminEmail'),
      superAdminPhone: get('superAdminPhone'),
      superAdminJobTitle: get('superAdminJobTitle'),
      financeName: get('financeName'),
      financeEmail: get('financeEmail'),
      financePhone: get('financePhone'),
      expiresInHours: Number(get('expiresInHours')) || 72,
    });
  };

  const copyLink = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Success screen: tenant provisioning kicked off; show the invite link.
  if (result) {
    return (
      <div className="flex-1 flex flex-col bg-stone-50 min-h-0 p-6">
        <div className="mx-auto w-full max-w-xl rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto mb-3 size-10 text-green-500" />
          <h1 className="text-lg font-bold text-stone-900">Customer onboarded</h1>
          <p className="mt-1 text-sm text-stone-500">
            Workspace <span className="font-semibold">{result.slug}</span> is provisioning its isolated database and
            seeding default workflows &amp; roles. Share this invite link with their super admin:
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-2">
            <code className="flex-1 truncate px-2 text-left text-xs text-stone-700">{result.inviteLink}</code>
            <button
              type="button"
              onClick={copyLink}
              aria-label="Copy invite link"
              className="flex items-center gap-1 rounded-md bg-brand px-2.5 py-1.5 text-xs font-semibold text-stone-950"
            >
              <Copy className="size-3.5" /> {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="mt-6 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/customer/onboarding')}
              className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-stone-950"
            >
              Back to customers
            </button>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"
            >
              Onboard another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-stone-50 min-h-0">
      <form onSubmit={handleSubmit} className="flex flex-col flex-1">
        {/* Page Header Bar */}
        <div className="bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Provisioning…' : 'Onboard'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => navigate('/customer/onboarding')}
              disabled={isPending}
              className="rounded border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>

          <nav className="hidden sm:flex items-center gap-1 text-xs text-stone-400 font-medium">
            <span>Customer</span>
            <span>/</span>
            <span className="text-stone-700 font-semibold">New Customer</span>
          </nav>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2.5 m-1">
            <AlertCircle className="size-3.5 mt-0.5 shrink-0 text-red-500" />
            <p className="text-xs text-red-700">{errorMessage}</p>
          </div>
        )}

        {/* Page Title */}
        <div className="bg-white border-b border-stone-100 px-6 py-2 flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-blue-100 flex items-center justify-center">
            <svg className="h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-sm font-bold text-stone-800">Customer</h1>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

          {/* Company Information */}
          <Section title="Company Information">
            <div className="grid grid-cols-3 gap-x-6 gap-y-3">
              <Field label="Company Name" required>
                <input name="companyName" required className={inputClass} />
              </Field>
              <Field label="Legal Name">
                <input name="legalName" className={inputClass} />
              </Field>
              <Field label="Industry">
                <input name="industry" className={inputClass} />
              </Field>
              <Field label="Website">
                <input name="website" type="url" className={inputClass} />
              </Field>
              <Field label="Country">
                <input name="country" className={inputClass} />
              </Field>
              <Field label="Currency">
                <input name="currency" className={inputClass} placeholder="e.g. USD" />
              </Field>
              <Field label="Timezone">
                <input name="timezone" className={inputClass} placeholder="e.g. America/New_York" />
              </Field>
              <Field label="Tax / VAT ID or EIN">
                <input name="taxId" className={inputClass} />
              </Field>
            </div>
          </Section>

          {/* Address Information */}
          <Section title="Address Information">
            <div className="grid grid-cols-3 gap-x-6 gap-y-3">
              <Field label="Billing Address">
                <textarea name="billingAddress" rows={3} className={`${inputClass} resize-none`} />
              </Field>
              <Field label="Shipping Address">
                <textarea name="shippingAddress" rows={3} className={`${inputClass} resize-none`} />
              </Field>
              <Field label="Return Address">
                <textarea name="returnAddress" rows={3} className={`${inputClass} resize-none`} />
              </Field>
            </div>
          </Section>

          {/* Super Admin Contact */}
          <Section title="Super Admin Contact">
            <div className="grid grid-cols-3 gap-x-6 gap-y-3">
              <Field label="Full Name">
                <input name="superAdminName" className={inputClass} />
              </Field>
              <Field label="Email" required>
                <input name="superAdminEmail" type="email" required className={inputClass} />
              </Field>
              <Field label="Phone">
                <input name="superAdminPhone" type="tel" className={inputClass} />
              </Field>
              <Field label="Job Title">
                <input name="superAdminJobTitle" className={inputClass} />
              </Field>
            </div>
          </Section>

          {/* Finance Contact */}
          <Section title="Finance Contact">
            <div className="grid grid-cols-3 gap-x-6 gap-y-3">
              <Field label="Name">
                <input name="financeName" className={inputClass} />
              </Field>
              <Field label="Email">
                <input name="financeEmail" type="email" className={inputClass} />
              </Field>
              <Field label="Phone">
                <input name="financePhone" type="tel" className={inputClass} />
              </Field>
            </div>
          </Section>

          {/* Invitation */}
          <Section title="Invitation">
            <div className="grid grid-cols-3 gap-x-6 gap-y-3">
              <Field label="Invite expires in (hours)">
                <input name="expiresInHours" type="number" min={1} defaultValue={72} className={inputClass} />
              </Field>
            </div>
            <p className="mt-2 text-[10px] text-stone-400">
              An invite link is emailed to the super admin and can be re-sent (with a fresh key &amp; expiry) from the customer list.
            </p>
          </Section>

        </div>
      </form>
    </div>
  );
}

const inputClass =
  'w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-800 outline-none placeholder:text-stone-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition';


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 border-b border-stone-200 bg-blue-50 px-4 py-2">
        <ChevronDown className="size-3 text-stone-400" />
        <h3 className="text-[11px] font-bold text-stone-700 uppercase tracking-wide">{title}</h3>
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
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
