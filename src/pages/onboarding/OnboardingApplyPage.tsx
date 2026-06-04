import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { onboardingService, type OnboardingFormData } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { OnboardingForm } from '@/components/customer/OnboardingForm';
import { Spinner, ErrorNote } from '@/components/tenant/ui';

export default function OnboardingApplyPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);

  const inviteQ = useQuery({
    queryKey: ['apply', token],
    queryFn: () => onboardingService.getApply(token),
    enabled: Boolean(token),
  });

  const submit = useMutation({
    mutationFn: (formData: OnboardingFormData) => onboardingService.submitApply(token, formData),
    onSuccess: () => setDone(true),
  });

  const shell = (children: React.ReactNode, wide = false) => (
    <div className="min-h-screen bg-stone-100 px-4 py-10 dark:bg-stone-950">
      <div className={`mx-auto w-full ${wide ? 'max-w-3xl' : 'max-w-md'}`}>{children}</div>
    </div>
  );
  const card = (children: React.ReactNode) => shell(
    <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
      {children}
    </div>,
  );

  if (!token) return card(<ErrorNote>Missing invite token.</ErrorNote>);
  if (inviteQ.isLoading) return card(<Spinner label="Loading invite…" />);
  if (inviteQ.error) return card(<ErrorNote>{apiErrorMessage(inviteQ.error)}</ErrorNote>);

  const invite = inviteQ.data;
  if (invite && !invite.valid) {
    return card(<ErrorNote>This invite is no longer valid (status: {invite.status}).</ErrorNote>);
  }

  if (done) {
    return card(
      <div className="text-center">
        <CheckCircle2 className="mx-auto mb-3 size-10 text-green-500" />
        <h1 className="text-lg font-bold text-stone-900 dark:text-white">Application submitted</h1>
        <p className="mt-1 text-sm text-stone-500">
          Thanks! Your onboarding details were sent for review. You'll receive an email to set your
          password once your workspace is approved.
        </p>
        <Link to="/auth/login" className="mt-5 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-stone-950">
          Go to sign in
        </Link>
      </div>,
    );
  }

  return shell(
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-stone-900 dark:text-white">Welcome to {invite?.tenantName}</h1>
        <p className="mt-1 text-sm text-stone-500">
          Complete your company onboarding details below. Your application will be reviewed before your
          workspace is activated.
        </p>
      </div>
      <OnboardingForm
        prefill={invite?.prefill}
        submitting={submit.isPending}
        errorMessage={submit.error ? apiErrorMessage(submit.error, 'Could not submit.') : null}
        onSubmit={(formData) => submit.mutate(formData)}
      />
    </div>,
  );
}
