import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { userService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ---------------------------------------------------------------------------

const schema = z
  .object({
    fullName: z.string().min(1, 'Full name is required').max(120),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

type Fields = z.infer<typeof schema>;

// ---------------------------------------------------------------------------

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [acceptedEmail, setAcceptedEmail] = useState('');

  const inviteQ = useQuery({
    queryKey: ['user-invite', token],
    queryFn: () => userService.getUserInvite(token),
    enabled: Boolean(token),
    retry: false,
  });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: inviteQ.data?.fullName ?? '',
    },
  });

  // Update fullName default once invite data loads.
  const defaultFullName = inviteQ.data?.fullName ?? '';

  const onSubmit = async (data: Fields) => {
    try {
      const result = await userService.acceptUserInvite({
        token,
        password: data.password,
        fullName: data.fullName,
      });
      setAcceptedEmail(result.email);
      setDone(true);
    } catch (err: unknown) {
      setError('root', { message: apiErrorMessage(err, 'Could not activate account.') });
    }
  };

  // ── No token ──────────────────────────────────────────────────────────────
  if (!token) {
    return (
      <Card>
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-3 size-8 text-red-400" />
          <h1 className="text-base font-bold text-stone-900">Invalid link</h1>
          <p className="mt-1 text-sm text-stone-500">
            This invitation link is missing or malformed.
          </p>
        </div>
      </Card>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (inviteQ.isLoading) {
    return <Card><Spinner label="Verifying invitation…" /></Card>;
  }

  // ── Token validation errors ───────────────────────────────────────────────
  if (inviteQ.isError) {
    const raw = inviteQ.error as { response?: { data?: { status?: string; message?: string } } };
    const status = raw?.response?.data?.status;
    const message = raw?.response?.data?.message;

    if (status === 'accepted') {
      return (
        <Card>
          <div className="text-center">
            <CheckCircle2 className="mx-auto mb-3 size-8 text-emerald-500" />
            <h1 className="text-base font-bold text-stone-900">Already accepted</h1>
            <p className="mt-1 text-sm text-stone-500">
              {message ?? 'This invitation has already been accepted. Please sign in.'}
            </p>
            <Link
              to="/auth/login"
              className="mt-5 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-stone-950"
            >
              Sign in
            </Link>
          </div>
        </Card>
      );
    }

    if (status === 'expired') {
      return (
        <Card>
          <div className="text-center">
            <Clock className="mx-auto mb-3 size-8 text-amber-400" />
            <h1 className="text-base font-bold text-stone-900">Invitation expired</h1>
            <p className="mt-1 text-sm text-stone-500">
              {message ?? 'This invitation has expired. Ask your workspace admin to resend it.'}
            </p>
          </div>
        </Card>
      );
    }

    if (status === 'revoked') {
      return (
        <Card>
          <div className="text-center">
            <AlertTriangle className="mx-auto mb-3 size-8 text-red-400" />
            <h1 className="text-base font-bold text-stone-900">Invitation revoked</h1>
            <p className="mt-1 text-sm text-stone-500">
              {message ?? 'This invitation has been revoked. Contact your workspace admin.'}
            </p>
          </div>
        </Card>
      );
    }

    return (
      <Card>
        <ErrorNote>{apiErrorMessage(inviteQ.error, 'This invitation link is invalid or has expired.')}</ErrorNote>
      </Card>
    );
  }

  // ── Success (account activated) ───────────────────────────────────────────
  if (done) {
    return (
      <Card>
        <div className="text-center">
          <CheckCircle2 className="mx-auto mb-3 size-10 text-emerald-500" />
          <h1 className="text-lg font-bold text-stone-900">You're all set!</h1>
          <p className="mt-1 text-sm text-stone-500">
            Account activated for <span className="font-semibold">{acceptedEmail}</span>.
            You can now sign in.
          </p>
          <Link
            to="/auth/login"
            className="mt-5 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-stone-950"
          >
            Go to sign in
          </Link>
        </div>
      </Card>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  const invite = inviteQ.data!;

  return (
    <Card>
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-dark mb-1">
          {invite.workspaceName}
        </p>
        <h1 className="text-lg font-bold text-stone-900">Join your workspace</h1>
        <p className="mt-1 text-xs text-stone-500">
          Setting up account for <span className="font-semibold">{invite.email}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            type="text"
            placeholder="Jane Smith"
            defaultValue={defaultFullName}
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? 'name-error' : undefined}
            {...register('fullName')}
            className="h-11"
          />
          {errors.fullName && (
            <p id="name-error" className="text-xs text-red-500">{errors.fullName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="at least 8 characters"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'pw-error' : undefined}
            {...register('password')}
            className="h-11"
          />
          {errors.password && (
            <p id="pw-error" className="text-xs text-red-500">{errors.password.message}</p>
          )}
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
          {errors.confirm && (
            <p id="confirm-error" className="text-xs text-red-500">{errors.confirm.message}</p>
          )}
        </div>

        {errors.root && <ErrorNote>{errors.root.message}</ErrorNote>}

        <Button type="submit" disabled={isSubmitting} className="h-11 w-full gap-2">
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting ? 'Activating…' : 'Activate account'}
        </Button>
      </form>
    </Card>
  );
}
