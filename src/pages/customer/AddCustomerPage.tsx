import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Copy, ArrowLeft } from 'lucide-react';
import { platformService, type OnboardingFormData } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { OnboardingForm } from '@/components/customer/OnboardingForm';
import type { CreateTenantResult } from '@/types/tenant';

export default function AddCustomerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<CreateTenantResult | null>(null);
  const [copied, setCopied] = useState(false);

  const onboard = useMutation({
    // Owner-filled form → provisions immediately + emails the customer a
    // password-setup link (no approval step).
    mutationFn: (formData: OnboardingFormData) => platformService.onboardCustomer(formData),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setResult(res);
    },
  });

  const copyLink = async () => {
    if (!result?.passwordSetupLink) return;
    await navigator.clipboard.writeText(result.passwordSetupLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (result) {
    return (
      <div className="flex-1 bg-stone-50 p-6">
        <div className="mx-auto w-full max-w-xl rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto mb-3 size-10 text-green-500" />
          <h1 className="text-lg font-bold text-stone-900">Customer onboarded</h1>
          <p className="mt-1 text-sm text-stone-500">
            Workspace <span className="font-semibold">{result.slug}</span> is provisioning. We emailed the
            super admin a link to set their password — share it directly if needed:
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-2">
            <code className="flex-1 truncate px-2 text-left text-xs text-stone-700">
              {result.passwordSetupLink}
            </code>
            <button
              type="button"
              onClick={copyLink}
              aria-label="Copy password-setup link"
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
    <div className="flex-1 bg-stone-50 p-6">
      <button
        type="button"
        onClick={() => navigate('/customer/onboarding')}
        className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-800"
      >
        <ArrowLeft className="size-3.5" /> Customer Onboarding
      </button>
      <h1 className="mb-4 text-base font-bold text-stone-900">Onboard a Customer</h1>
      <OnboardingForm
        submitting={onboard.isPending}
        errorMessage={onboard.error ? apiErrorMessage(onboard.error, 'Onboarding failed.') : null}
        onSubmit={(formData) => onboard.mutate(formData)}
      />
    </div>
  );
}
