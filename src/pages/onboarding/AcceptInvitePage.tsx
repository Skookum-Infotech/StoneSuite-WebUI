import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { userService } from '@/services/tenantServices';
import { authService } from '@/services/authService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// One token namespace, one accept path per kind: a staff workspace invite
// (user_invites, /api/onboarding/user-invite/*) and a customer-portal invite
// (portal_invites, /api/portal/auth/invite/*, see CLAUDE.md's merged-login
// design). Both land on this one URL — the invite email no longer says which
// kind it is — so this page tries the staff lookup first and falls back to
// the portal lookup only once that one settles as an error (a portal token
// simply does not exist in user_invites, a clean 404, never ambiguous).

const buildSchema = (requireFullName: boolean) =>
  z
    .object({
      fullName: requireFullName
        ? z.string().min(1, 'Full name is required').max(120)
        : z.string().optional(),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      confirm: z.string().min(1, 'Please confirm your password'),
    })
    .refine((d) => d.password === d.confirm, {
      message: 'Passwords do not match',
      path: ['confirm'],
    });

type Fields = z.infer<ReturnType<typeof buildSchema>>;

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

  const staffInviteQ = useQuery({
    queryKey: ['user-invite', token],
    queryFn: () => userService.getUserInvite(token),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  });

  // Waterfall: only fires once the staff lookup has settled as an error, so
  // a genuine staff invite never pays for a second round trip.
  const portalInviteQ = useQuery({
    queryKey: ['portal-invite', token],
    queryFn: () => authService.getPortalInvite(token),
    enabled: Boolean(token) && staffInviteQ.isError,
    retry: false,
    staleTime: Infinity,
  });

  const isLoading = staffInviteQ.isLoading || (staffInviteQ.isError && portalInviteQ.isLoading);
  const kind: 'staff' | 'portal' | null = staffInviteQ.data ? 'staff' : portalInviteQ.data ? 'portal' : null;
  const invite = staffInviteQ.data ?? portalInviteQ.data;
  // Once staff has failed, the portal attempt is authoritative for what the
  // user sees — new invites minted by this codebase are portal-shaped by
  // default (see controllers/portal_auth.go's portalInviteLink), so a token
  // that resolves nowhere is far more likely to be an expired/consumed
  // portal invite than a staff one.
  const settledError = staffInviteQ.isError && portalInviteQ.isError ? portalInviteQ.error : null;

  const schema = buildSchema(kind === 'staff');
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: invite?.fullName ?? '',
    },
  });

  const onSubmit = async (data: Fields) => {
    try {
      if (kind === 'staff') {
        const result = await userService.acceptUserInvite({
          token,
          password: data.password,
          fullName: data.fullName ?? '',
        });
        setAcceptedEmail(result.email);
      } else {
        await authService.acceptPortalInvite(token, data.password);
        setAcceptedEmail(invite?.email ?? '');
      }
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
  if (isLoading) {
    return <Card><Spinner label="Verifying invitation…" /></Card>;
  }

  // ── Token validation errors (both lookups settled, neither resolved) ──────
  if (settledError) {
    const raw = settledError as { response?: { data?: { status?: string; message?: string } } };
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
              {message ?? 'This invitation has expired. Ask whoever invited you to send a new one.'}
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
              {message ?? 'This invitation has been revoked. Contact whoever invited you.'}
            </p>
          </div>
        </Card>
      );
    }

    return (
      <Card>
        <ErrorNote>{apiErrorMessage(settledError, 'This invitation link is invalid or has expired.')}</ErrorNote>
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
  // Reached only once one of the two queries has resolved, so invite/kind
  // are guaranteed non-null here.
  return (
    <Card>
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-dark mb-1">
          {invite!.workspaceName}
        </p>
        <h1 className="text-lg font-bold text-stone-900">
          {kind === 'portal' ? 'Set your password' : 'Join your workspace'}
        </h1>
        <p className="mt-1 text-xs text-stone-500">
          {kind === 'portal' ? 'Setting up portal access for' : 'Setting up account for'}{' '}
          <span className="font-semibold">{invite!.email}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {kind === 'staff' && (
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Jane Smith"
              defaultValue={invite!.fullName}
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? 'name-error' : undefined}
              {...register('fullName')}
              className="h-11"
            />
            {errors.fullName && (
              <p id="name-error" className="text-xs text-red-500">{errors.fullName.message}</p>
            )}
          </div>
        )}

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
