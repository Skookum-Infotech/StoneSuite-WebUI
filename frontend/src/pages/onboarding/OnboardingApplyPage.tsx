import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CheckCircle2, ArrowRight, Building2, MapPin, ShieldCheck, Banknote } from 'lucide-react';
import { onboardingService, type OnboardingFormData } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { OnboardingForm } from '@/components/customer/OnboardingForm';
import { Spinner, ErrorNote } from '@/components/tenant/ui';

const STEPS = [
  { icon: Building2,  label: 'Company details & legal info' },
  { icon: MapPin,     label: 'Business address' },
  { icon: ShieldCheck,label: 'Primary admin contact' },
  { icon: Banknote,   label: 'Finance contact' },
];

export default function OnboardingApplyPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);

  const inviteQ = useQuery({
    queryKey: ['apply', token],
    queryFn: () => onboardingService.getApply(token),
    enabled: Boolean(token),
    staleTime: Infinity,
  });

  const submit = useMutation({
    mutationFn: (formData: OnboardingFormData) => onboardingService.submitApply(token, formData),
    onSuccess: () => setDone(true),
  });

  // ── Simple centred card for edge-case states ─────────────────────────────
  const centred = (children: React.ReactNode) => (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        {children}
      </div>
    </div>
  );

  if (!token)        return centred(<ErrorNote>Missing invite token.</ErrorNote>);
  if (inviteQ.isLoading) return centred(<Spinner label="Loading invite…" />);
  if (inviteQ.error) return centred(<ErrorNote>{apiErrorMessage(inviteQ.error)}</ErrorNote>);

  const invite = inviteQ.data;
  if (invite && !invite.valid) {
    return centred(<ErrorNote>This invite is no longer valid (status: {invite.status}).</ErrorNote>);
  }

  if (done) {
    return centred(
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="size-7 text-green-600" />
        </div>
        <h1 className="text-lg font-bold text-stone-900">Application submitted!</h1>
        <p className="mt-2 text-sm text-stone-500 leading-relaxed">
          Thanks! Your onboarding details were sent for review. You'll receive an email to set your
          password once your workspace is approved.
        </p>
        <Link
          to="/auth/login"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-stone-950 hover:bg-brand/80 transition-colors"
        >
          Go to sign in <ArrowRight className="size-4" />
        </Link>
      </div>,
    );
  }

  // ── Main two-panel layout ────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen">

      {/* ── Left panel: branding + steps ── */}
      <aside
        className="hidden lg:flex lg:w-[380px] xl:w-[420px] shrink-0 flex-col justify-between p-10 sticky top-0 h-screen"
        style={{ background: 'linear-gradient(155deg, #001219 0%, #005f73 45%, #0a2540 75%, #050e1a 100%)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img src="/logo-only.png" alt="Stone Suite" className="h-9 w-9 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]" />
          <span className="font-brand text-sm font-semibold uppercase tracking-[0.22em] text-white/90">
            Stone Suite
          </span>
        </div>

        {/* Headline */}
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-400 mb-2">
              Customer Onboarding
            </p>
            <h1 className="text-2xl font-bold leading-snug text-white">
              Welcome to<br />
              <span className="text-teal-300">{invite?.tenantName ?? 'your workspace'}</span>
            </h1>
            <p className="mt-3 text-sm text-white/50 leading-relaxed">
              Complete the form to set up your company profile. Your application will be
              reviewed before your workspace is activated.
            </p>
          </div>

          {/* Steps checklist */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/30">
              What you'll fill in
            </p>
            {STEPS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.07]">
                  <Icon className="size-3.5 text-teal-400" />
                </div>
                <span className="text-sm text-white/70">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-white/25">
          Need help? Contact{' '}
          <a href="mailto:support@stonesuite.app" className="text-teal-400/70 hover:text-teal-400 underline">
            support@stonesuite.app
          </a>
        </p>
      </aside>

      {/* ── Right panel: form ── */}
      <main className="flex-1 overflow-y-auto bg-stone-50">
        {/* Mobile header */}
        <div
          className="lg:hidden flex items-center gap-3 px-6 py-4"
          style={{ background: 'linear-gradient(135deg, #001219, #005f73)' }}
        >
          <img src="/logo-only.png" alt="Stone Suite" className="h-7 w-7 object-contain" />
          <span className="text-sm font-semibold text-white/90 tracking-wide">Stone Suite</span>
        </div>

        <div className="px-8 py-10 h-full">
          {/* Page heading (visible on mobile too) */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-stone-900">
              {invite?.tenantName ? `Welcome to ${invite.tenantName}` : 'Company Onboarding'}
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Fill in your company details below. All fields marked <span className="text-red-500">*</span> are required.
            </p>
          </div>

          <OnboardingForm
            prefill={invite?.prefill}
            submitting={submit.isPending}
            errorMessage={submit.error ? apiErrorMessage(submit.error, 'Could not submit.') : null}
            onSubmit={(formData) => submit.mutate(formData)}
          />
        </div>
      </main>
    </div>
  );
}
