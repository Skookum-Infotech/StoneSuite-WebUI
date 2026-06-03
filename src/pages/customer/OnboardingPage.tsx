import { useState } from 'react';
import { UserPlus, Plus, ChevronRight, Copy, RefreshCw, KeyRound } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Navigate } from 'react-router-dom';
import { platformService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { useAuthStore } from '@/store/useAuthStore';
import { Badge, Spinner, ErrorNote, EmptyState } from '@/components/tenant/ui';
import type { Tenant } from '@/types/tenant';

const STATUS_COLOR: Record<string, string> = {
  active: '#22c55e',
  provisioning: '#f59e0b',
  invited: '#3b82f6',
  suspended: '#a8a29e',
  deleted: '#ef4444',
  pending: '#3b82f6',
  accepted: '#22c55e',
};

export default function OnboardingPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const { data: tenants = [], isLoading, isError, error } = useQuery({
    queryKey: ['tenants'],
    queryFn: platformService.listTenants,
    enabled: Boolean(user?.isPlatformAdmin),
  });

  // Owner-only: customer onboarding manages all tenants on the platform.
  if (user && !user.isPlatformAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="bg-white p-6 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/20 text-brand-dark">
              <UserPlus className="size-4.5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-stone-900">Customer Onboarding</h1>
              <p className="text-xs text-stone-500">
                Provision isolated customer workspaces and manage onboarding invites.
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/customer/onboarding/new')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-2 px-3 text-xs font-semibold shadow-sm transition hover:bg-brand/50 cursor-pointer"
          >
            <Plus className="size-3.5" />
            Onboard Customer
          </button>
        </div>

        <div className="mt-5 border-t border-stone-100 pt-4 flex-1 flex flex-col min-h-0">
          {isLoading && <Spinner label="Loading customers…" />}
          {isError && <ErrorNote>{apiErrorMessage(error, 'Failed to load customers.')}</ErrorNote>}
          {!isLoading && !isError && tenants.length === 0 && (
            <EmptyState>No customers yet — onboard your first one.</EmptyState>
          )}

          <div className="space-y-2">
            {tenants.map((t) => (
              <TenantRow key={t.id} tenant={t} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TenantRow({ tenant }: { tenant: Tenant }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-stone-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Toggle invites for ${tenant.displayName}`}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-stone-50/60"
      >
        <div className="flex items-center gap-3">
          <ChevronRight className={`size-4 text-stone-400 transition-transform ${open ? 'rotate-90' : ''}`} />
          <div>
            <p className="text-sm font-bold text-stone-800">{tenant.displayName}</p>
            <p className="text-[11px] text-stone-500">
              {tenant.slug} · {tenant.dbName || 'db pending'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge color={STATUS_COLOR[tenant.status] ?? undefined}>{tenant.status}</Badge>
          <span className="hidden text-[11px] text-stone-400 sm:inline">
            {tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : ''}
          </span>
        </div>
      </button>

      {open && <InvitesPanel tenant={tenant} />}
    </div>
  );
}

function InvitesPanel({ tenant }: { tenant: Tenant }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState<string | null>(null);
  const [hours, setHours] = useState(72);

  const invitesQ = useQuery({
    queryKey: ['invites', tenant.id],
    queryFn: () => platformService.listInvites(tenant.id),
  });

  const resend = useMutation({
    mutationFn: () => platformService.resendInvite(tenant.id, { expiresInHours: hours }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invites', tenant.id] });
      qc.invalidateQueries({ queryKey: ['tenants'] });
    },
  });
  const resentNote =
    resend.isSuccess && resend.data
      ? resend.data.emailSent
        ? 'Invite re-sent — email delivered.'
        : 'Invite re-issued with a fresh key & expiry. Email could not be sent — copy the link below.'
      : null;

  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
  };

  return (
    <div className="border-t border-stone-100 bg-stone-50/50 px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold text-stone-600">Invites</h3>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-stone-500">
            Expires in (h)
            <input
              type="number"
              min={1}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value) || 72)}
              aria-label="Resend expiry in hours"
              className="ml-1.5 w-16 rounded border border-stone-300 px-1.5 py-1 text-xs"
            />
          </label>
          <button
            type="button"
            onClick={() => resend.mutate()}
            disabled={resend.isPending}
            className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-[11px] font-semibold text-stone-950 disabled:opacity-50"
          >
            <RefreshCw className={`size-3 ${resend.isPending ? 'animate-spin' : ''}`} />
            {resend.isPending ? 'Sending…' : 'Resend invite'}
          </button>
        </div>
      </div>

      {invitesQ.isLoading && <Spinner label="Loading invites…" />}
      {invitesQ.error && <ErrorNote>{apiErrorMessage(invitesQ.error)}</ErrorNote>}
      {resend.error && <div className="mb-2"><ErrorNote>{apiErrorMessage(resend.error)}</ErrorNote></div>}
      {resentNote && (
        <p className="mb-2 rounded-lg bg-brand/15 px-3 py-2 text-[11px] font-medium text-stone-600">{resentNote}</p>
      )}
      {invitesQ.data && invitesQ.data.length === 0 && (
        <EmptyState>No invites yet — use “Resend invite” to send one.</EmptyState>
      )}

      <div className="space-y-2">
        {invitesQ.data?.map((inv) => {
          const status = inv.expired ? 'expired' : inv.status;
          return (
            <div key={inv.id} className="rounded-lg border border-stone-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-stone-700">{inv.contactEmail}</span>
                <Badge color={inv.expired ? '#ef4444' : STATUS_COLOR[inv.status] ?? undefined}>{status}</Badge>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <KeyRound className="size-3.5 shrink-0 text-stone-400" />
                <code className="flex-1 truncate rounded bg-stone-100 px-2 py-1 text-[11px] text-stone-600">{inv.token}</code>
                <button
                  type="button"
                  onClick={() => copy(inv.token, `key-${inv.id}`)}
                  aria-label="Copy invite key"
                  className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                >
                  <Copy className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => copy(inv.inviteLink, `link-${inv.id}`)}
                  className="rounded-md border border-stone-200 px-2 py-1 text-[10px] font-semibold text-stone-500 hover:bg-stone-100"
                >
                  {copied === `link-${inv.id}` ? 'Link copied' : copied === `key-${inv.id}` ? 'Key copied' : 'Copy link'}
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-stone-400">
                Expires {new Date(inv.expiresAt).toLocaleString()}
                {inv.acceptedAt && ` · accepted ${new Date(inv.acceptedAt).toLocaleDateString()}`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
