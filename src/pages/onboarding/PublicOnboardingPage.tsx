import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronDown, CheckCircle, XCircle, Clock } from 'lucide-react';
import { AxiosError } from 'axios';
import { customerService } from '@/services/customerService';
import type { OnboardingInvite } from '@/types/customer';

type InviteState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'expired' }
  | { status: 'accepted' }
  | { status: 'ready'; invite: OnboardingInvite; companyName: string; recipientName: string; recipientEmail: string }
  | { status: 'submitted' };

export default function PublicOnboardingPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<InviteState>(() =>
    token ? { status: 'loading' } : { status: 'error', message: 'No invitation token provided.' }
  );
  const [isPending, setIsPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    customerService.getInviteByToken(token).then((data) => {
      const invite = data.invite;
      if (!invite) {
        setState({ status: 'error', message: 'Invitation not found.' });
        return;
      }
      if (invite.status === 'expired') {
        setState({ status: 'expired' });
        return;
      }
      if (invite.status === 'accepted') {
        setState({ status: 'accepted' });
        return;
      }
      setState({
        status: 'ready',
        invite,
        companyName: data.companyName ?? '',
        recipientName: data.recipientName ?? '',
        recipientEmail: invite.contactEmail,
      });
    }).catch(() => {
      setState({ status: 'error', message: 'Failed to load invitation. The link may be invalid.' });
    });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state.status !== 'ready' || !token) return;

    const form = new FormData(e.currentTarget);
    const get = (key: string) => String(form.get(key) ?? '').trim();
    setIsPending(true);
    setSubmitError(null);

    try {
      await customerService.submitOnboarding({
        token,
        name: get('companyName'),
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
      });
      setState({ status: 'submitted' });
    } catch (err) {
      const msg =
        err instanceof AxiosError
          ? err.response?.data?.message ?? err.message
          : err instanceof Error
            ? err.message
            : 'Submission failed. Please try again.';
      setSubmitError(msg);
    } finally {
      setIsPending(false);
    }
  };

  if (state.status === 'loading') {
    return <StatusScreen icon={<Clock className="size-8 text-stone-400 animate-pulse" />} title="Loading your invitation…" />;
  }

  if (state.status === 'error') {
    return <StatusScreen icon={<XCircle className="size-8 text-red-400" />} title="Invitation not found" message={state.message} />;
  }

  if (state.status === 'expired') {
    return (
      <StatusScreen
        icon={<Clock className="size-8 text-amber-400" />}
        title="Invitation expired"
        message="This invitation link has expired. Please contact the team to request a new one."
      />
    );
  }

  if (state.status === 'accepted') {
    return (
      <StatusScreen
        icon={<CheckCircle className="size-8 text-green-500" />}
        title="Already submitted"
        message="This invitation has already been completed. Thank you!"
      />
    );
  }

  if (state.status === 'submitted') {
    return (
      <StatusScreen
        icon={<CheckCircle className="size-8 text-green-500" />}
        title="Thank you!"
        message="Your information has been submitted successfully. Our team will be in touch shortly."
      />
    );
  }

  const { companyName, recipientName, recipientEmail } = state;

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center gap-3">
        <div className="h-6 w-6 rounded bg-blue-600 flex items-center justify-center">
          <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <span className="text-sm font-bold text-stone-800">StoneSuite</span>
        <span className="ml-auto text-xs text-stone-400">Customer Onboarding</span>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
        {/* Welcome block */}
        <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
          <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide mb-1">You're invited</p>
          <h1 className="text-base font-bold text-stone-900">Complete your onboarding</h1>
          <p className="text-xs text-stone-500 mt-1">
            Hi <strong>{recipientName || recipientEmail}</strong>, please fill in the details below to complete onboarding for <strong>{companyName}</strong>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Section title="Company Information">
            <div className="grid grid-cols-2 gap-x-5 gap-y-3">
              <Field label="Company Name" required>
                <input name="companyName" required defaultValue={companyName} className={inputClass} />
              </Field>
              <Field label="Legal Name" required>
                <input name="legalName" required className={inputClass} />
              </Field>
              <Field label="Industry">
                <input name="industry" className={inputClass} />
              </Field>
              <Field label="Website" required>
                <input name="website" type="url" required className={inputClass} />
              </Field>
              <Field label="Country" required>
                <input name="country" required className={inputClass} />
              </Field>
              <Field label="Currency" required>
                <input name="currency" required className={inputClass} placeholder="e.g. USD" />
              </Field>
              <Field label="Timezone" required>
                <input name="timezone" required className={inputClass} placeholder="e.g. America/New_York" />
              </Field>
              <Field label="Tax / VAT ID or EIN">
                <input name="taxId" className={inputClass} />
              </Field>
            </div>
          </Section>

          <Section title="Address Information">
            <div className="grid grid-cols-2 gap-x-5 gap-y-3">
              <Field label="Billing Address" required>
                <textarea name="billingAddress" required rows={3} className={`${inputClass} resize-none`} />
              </Field>
              <Field label="Shipping Address">
                <textarea name="shippingAddress" rows={3} className={`${inputClass} resize-none`} />
              </Field>
              <Field label="Return Address">
                <textarea name="returnAddress" rows={3} className={`${inputClass} resize-none`} />
              </Field>
            </div>
          </Section>

          <Section title="Super Admin Contact">
            <div className="grid grid-cols-2 gap-x-5 gap-y-3">
              <Field label="Full Name" required>
                <input name="superAdminName" required defaultValue={recipientName} className={inputClass} />
              </Field>
              <Field label="Email" required>
                <input name="superAdminEmail" type="email" required defaultValue={recipientEmail} className={inputClass} />
              </Field>
              <Field label="Phone">
                <input name="superAdminPhone" type="tel" className={inputClass} />
              </Field>
              <Field label="Job Title">
                <input name="superAdminJobTitle" className={inputClass} />
              </Field>
            </div>
          </Section>

          <Section title="Finance Contact">
            <div className="grid grid-cols-2 gap-x-5 gap-y-3">
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

          {submitError && (
            <p className="text-xs text-red-500 px-1">{submitError}</p>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Submitting…' : 'Submit Onboarding'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function StatusScreen({ icon, title, message }: { icon: React.ReactNode; title: string; message?: string }) {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="flex justify-center">{icon}</div>
        <h2 className="text-base font-bold text-stone-800">{title}</h2>
        {message && <p className="text-xs text-stone-500 max-w-xs">{message}</p>}
      </div>
    </div>
  );
}

const inputClass =
  'w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800 outline-none placeholder:text-stone-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition';

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
