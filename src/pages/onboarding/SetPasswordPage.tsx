import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { onboardingService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner, ErrorNote } from '@/components/tenant/ui';

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

type Fields = z.infer<typeof schema>;

export default function SetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);

  const tokenQ = useQuery({
    queryKey: ['set-password', token],
    queryFn: () => onboardingService.getSetPassword(token),
    enabled: Boolean(token),
    retry: false,
  });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Fields) => {
    try {
      await onboardingService.setPassword(token, data.password);
      setDone(true);
    } catch (err: unknown) {
      setError('root', { message: apiErrorMessage(err, 'Could not set password.') });
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="min 8 characters"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'pw-error' : undefined}
            {...register('password')}
            className="h-11"
          />
          {errors.password && <p id="pw-error" className="text-xs text-red-500">{errors.password.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            aria-invalid={Boolean(errors.confirm)}
            aria-describedby={errors.confirm ? 'confirm-error' : undefined}
            {...register('confirm')}
            className="h-11"
          />
          {errors.confirm && <p id="confirm-error" className="text-xs text-red-500">{errors.confirm.message}</p>}
        </div>
        {errors.root && <ErrorNote>{errors.root.message}</ErrorNote>}
        <Button type="submit" disabled={isSubmitting} className="h-11 w-full gap-2">
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting ? 'Saving…' : 'Set password'}
        </Button>
      </form>
    </>,
  );
}
