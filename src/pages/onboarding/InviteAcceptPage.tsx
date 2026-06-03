import { useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { onboardingService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner, ErrorNote } from '@/components/tenant/ui';

export default function InviteAcceptPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const inviteQ = useQuery({
    queryKey: ['invite', token],
    queryFn: () => onboardingService.getInvite(token),
    enabled: Boolean(token),
  });

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onboardingService.accept(token, fullName, password);
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not accept invite.'));
    } finally {
      setSubmitting(false);
    }
  };

  const card = (children: ReactNode) => (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 p-4 dark:bg-stone-950">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        {children}
      </div>
    </div>
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
        <h1 className="text-lg font-bold text-stone-900 dark:text-white">Workspace is being set up</h1>
        <p className="mt-1 text-sm text-stone-500">
          Your account was created and your isolated database is provisioning. This takes a few seconds.
        </p>
        <Link to="/auth/login" className="mt-5 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-stone-950">
          Go to sign in
        </Link>
      </div>,
    );
  }

  return card(
    <>
      <div className="mb-6 text-center">
        <h1 className="text-lg font-bold text-stone-900 dark:text-white">Join {invite?.tenantName}</h1>
        <p className="mt-1 text-xs text-stone-500">Set up your account for {invite?.contactEmail}</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" placeholder="min 8 characters" required minLength={8} />
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" disabled={submitting} className="h-11 w-full gap-2">
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitting ? 'Creating account…' : 'Accept invite'}
        </Button>
      </form>
    </>,
  );
}
