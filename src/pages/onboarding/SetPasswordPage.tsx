import { useState, type FormEvent } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { onboardingService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner, ErrorNote } from '@/components/tenant/ui';

export default function SetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const tokenQ = useQuery({
    queryKey: ['set-password', token],
    queryFn: () => onboardingService.getSetPassword(token),
    enabled: Boolean(token),
    retry: false,
  });

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await onboardingService.setPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not set password.'));
    } finally {
      setSubmitting(false);
    }
  };

  const card = (children: React.ReactNode) => (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 p-4 dark:bg-stone-950">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        {children}
      </div>
    </div>
  );

  if (!token) return card(<ErrorNote>Missing token.</ErrorNote>);
  if (tokenQ.isLoading) return card(<Spinner label="Verifying link…" />);
  if (tokenQ.error) return card(<ErrorNote>{apiErrorMessage(tokenQ.error, 'This link is invalid or has expired.')}</ErrorNote>);

  if (done) {
    return card(
      <div className="text-center">
        <CheckCircle2 className="mx-auto mb-3 size-10 text-green-500" />
        <h1 className="text-lg font-bold text-stone-900 dark:text-white">You're all set</h1>
        <p className="mt-1 text-sm text-stone-500">Your password has been set. You can now sign in.</p>
        <Link to="/auth/login" className="mt-5 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-stone-950">
          Go to sign in
        </Link>
      </div>,
    );
  }

  return card(
    <>
      <div className="mb-6 text-center">
        <h1 className="text-lg font-bold text-stone-900 dark:text-white">Set your password</h1>
        <p className="mt-1 text-xs text-stone-500">for {tokenQ.data?.email}</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" placeholder="min 8 characters" required minLength={8} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11" required minLength={8} />
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" disabled={submitting} className="h-11 w-full gap-2">
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitting ? 'Saving…' : 'Set password'}
        </Button>
      </form>
    </>,
  );
}
