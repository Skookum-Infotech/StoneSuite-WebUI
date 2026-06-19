import { useState } from 'react';
import { UserPlus, Plus, Send, ChevronRight, Copy, RefreshCw, KeyRound, Check, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Navigate } from 'react-router-dom';
import { platformService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { useAuthStore } from '@/store/useAuthStore';
import { Badge, Spinner, ErrorNote, EmptyState } from '@/components/tenant/ui';
import { InviteCustomerModal } from '@/components/customer/InviteCustomerModal';
import type { AsyncJob, Tenant } from '@/types/tenant';

const STATUS_COLOR: Record<string, string> = {
  active: '#22c55e',
  provisioning: '#f59e0b',
  submitted: '#8b5cf6',
  invited: '#3b82f6',
  suspended: '#a8a29e',
  rejected: '#ef4444',
  deleted: '#ef4444',
  pending: '#3b82f6',
  accepted: '#22c55e',
};

const JOB_STATUS_COLOR: Record<string, string> = {
  pending: '#3b82f6',
  running: '#f59e0b',
  succeeded: '#22c55e',
  failed: '#ef4444',
  dead: '#ef4444',
};

// Polling cadence while a job is still pending/running (ADR-1: lightweight
// polling instead of WebSockets at current scale).
const JOB_POLL_INTERVAL_MS = 3000;

export default function OnboardingPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [showInvite, setShowInvite] = useState(false);

  const tenantsQ = useQuery({
    queryKey: ['tenants'],
    queryFn: platformService.listTenants,
    enabled: Boolean(user?.isPlatformAdmin),
  });

  if (user && !user.isPlatformAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const tenants = tenantsQ.data ?? [];
  const pending = tenants.filter((t) => t.status === 'submitted');

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-6 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/20 text-brand-dark">
              <UserPlus className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-stone-900">Customer Onboarding</h1>
              <p className="text-sm text-stone-500">
                Invite customers to self-onboard, or onboard them directly. Review applications before activation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInvite(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-xs font-semibold text-stone-800 shadow-sm transition hover:bg-brand/20"
            >
              <Send className="size-3.5" />
              Invite
            </button>
            <button
              onClick={() => navigate('/customer/onboarding/new')}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-stone-950 shadow-sm transition hover:bg-brand/50"
            >
              <Plus className="size-3.5" />
              Onboard Customer
            </button>
          </div>
        </div>

        <div className="mt-5 flex-1 flex flex-col min-h-0 border-t border-stone-100 pt-4">
          {tenantsQ.isLoading && <Spinner label="Loading customers…" />}
          {tenantsQ.isError && <ErrorNote>{apiErrorMessage(tenantsQ.error, 'Failed to load customers.')}</ErrorNote>}

          {/* Pending approvals */}
          {pending.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">
                Pending approvals ({pending.length})
              </h2>
              <div className="space-y-2">
                {pending.map((t) => (
                  <ApprovalCard key={t.id} tenant={t} />
                ))}
              </div>
            </section>
          )}

          {/* All customers */}
          {!tenantsQ.isLoading && !tenantsQ.isError && tenants.length === 0 && (
            <EmptyState>No customers yet — invite or onboard your first one.</EmptyState>
          )}
          {tenants.length > 0 && (
            <>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Customers</h2>
              <div className="space-y-2">
                {tenants.map((t) => (
                  <TenantRow key={t.id} tenant={t} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {showInvite && <InviteCustomerModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}

// ----- Pending approval card ------------------------------------------------

function ApprovalCard({ tenant }: { tenant: Tenant }) {
  const qc = useQueryClient();
  const meta = (tenant.metadata ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof meta[k] === 'string' ? (meta[k] as string) : '');
  const invalidate = () => qc.invalidateQueries({ queryKey: ['tenants'] });

  const approve = useMutation({
    mutationFn: () => platformService.approveTenant(tenant.id),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: () => platformService.rejectTenant(tenant.id),
    onSuccess: invalidate,
  });

  // Show the submitted fields (skip empties), prettifying snake_case keys.
  const entries = Object.entries(meta).filter(([, v]) => typeof v === 'string' && v !== '');

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-stone-800">{str('company_name') || tenant.displayName}</p>
          <p className="text-label text-stone-500">{str('super_admin_email')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => reject.mutate()}
            disabled={reject.isPending || approve.isPending}
            className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-label font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            <X className="size-3" /> Reject
          </button>
          <button
            type="button"
            onClick={() => approve.mutate()}
            disabled={approve.isPending || reject.isPending}
            className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-label font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Check className="size-3" /> {approve.isPending ? 'Approving…' : 'Approve'}
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
        {entries.map(([k, v]) => (
          <div key={k} className="flex gap-2 text-label">
            <span className="shrink-0 font-semibold capitalize text-stone-500">{k.replace(/_/g, ' ')}:</span>
            <span className="truncate text-stone-700">{String(v)}</span>
          </div>
        ))}
      </div>

      {(approve.error || reject.error) && (
        <div className="mt-2">
          <ErrorNote>{apiErrorMessage(approve.error || reject.error)}</ErrorNote>
        </div>
      )}
    </div>
  );
}

// ----- Customer row + invites panel -----------------------------------------

const MIGRATION_COLOR: Record<string, string> = {
  migrated: '#22c55e',
  pending: '#f59e0b',
  failed: '#ef4444',
};

function tenantInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

function TenantRow({ tenant }: { tenant: Tenant }) {
  const [open, setOpen] = useState(false);
  const meta = (tenant.metadata ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof meta[k] === 'string' ? (meta[k] as string) : '');

  const contactEmail = str('super_admin_email') || str('contact_email') || str('email');
  const phone = str('phone') || str('contact_phone');
  const industry = str('industry') || str('business_type');
  const website = str('website') || str('company_website');

  // Non-empty metadata entries not already shown in the header detail row
  const primaryKeys = new Set(['company_name', 'super_admin_email', 'contact_email', 'email', 'phone', 'contact_phone', 'industry', 'business_type', 'website', 'company_website']);
  const extraMeta = Object.entries(meta).filter(
    ([k, v]) => !primaryKeys.has(k) && typeof v === 'string' && (v as string) !== '',
  );

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      {/* ── Collapsed header row ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Toggle details for ${tenant.displayName}`}
        className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-stone-50 transition-colors"
      >
        {/* Avatar */}
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
          style={{ backgroundColor: STATUS_COLOR[tenant.status] ?? '#a8a29e' }}
        >
          {tenantInitials(tenant.displayName)}
        </div>

        {/* Name + identifiers */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-stone-900">{tenant.displayName}</p>
            <Badge color={STATUS_COLOR[tenant.status] ?? undefined}>{tenant.status}</Badge>
            {tenant.migrationStatus && (
              <Badge color={MIGRATION_COLOR[tenant.migrationStatus] ?? '#a8a29e'}>
                db {tenant.migrationStatus}
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="text-label text-stone-400 font-mono">{tenant.slug}</span>
            {contactEmail && (
              <span className="text-label text-stone-500">{contactEmail}</span>
            )}
            {phone && (
              <span className="text-label text-stone-500">{phone}</span>
            )}
          </div>
        </div>

        {/* Right meta */}
        <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0">
          <span className="text-label text-stone-400">
            {tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
          </span>
          {tenant.dbName && (
            <span className="font-mono text-2xs text-stone-300">{tenant.dbName}</span>
          )}
        </div>

        <ChevronRight
          className={`size-4 shrink-0 text-stone-300 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {/* ── Expanded detail panel ── */}
      {open && (
        <div className="border-t border-stone-100">
          {/* Detail grid */}
          <div className="grid grid-cols-2 gap-px bg-stone-100 sm:grid-cols-4">
            <DetailCell label="Database" value={tenant.dbName || '—'} mono />
            <DetailCell label="DB Migration" value={tenant.migrationStatus || '—'} />
            <DetailCell
              label="Onboarded"
              value={tenant.createdAt ? new Date(tenant.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
            />
            <DetailCell
              label="Auto-delete after"
              value={tenant.hardDeleteAfter ? new Date(tenant.hardDeleteAfter).toLocaleDateString() : 'Not scheduled'}
              dimmed={!tenant.hardDeleteAfter}
            />
          </div>

          {/* Extra onboarding metadata */}
          {(industry || website || extraMeta.length > 0) && (
            <div className="grid grid-cols-2 gap-px bg-stone-100 sm:grid-cols-4 border-t border-stone-100">
              {industry && <DetailCell label="Industry" value={industry} />}
              {website && <DetailCell label="Website" value={website} />}
              {extraMeta.map(([k, v]) => (
                <DetailCell key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
              ))}
            </div>
          )}

          <JobsPanel tenant={tenant} />
          <InvitesPanel tenant={tenant} />
        </div>
      )}
    </div>
  );
}

function DetailCell({ label, value, mono = false, dimmed = false }: {
  label: string;
  value: string;
  mono?: boolean;
  dimmed?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 bg-white px-4 py-3">
      <span className="text-2xs font-semibold uppercase tracking-wide text-stone-400">{label}</span>
      <span className={`text-xs truncate ${mono ? 'font-mono' : 'font-medium'} ${dimmed ? 'text-stone-300' : 'text-stone-700'}`}>
        {value}
      </span>
    </div>
  );
}

// ----- Async job (provisioning) status panel --------------------------------

function JobsPanel({ tenant }: { tenant: Tenant }) {
  const qc = useQueryClient();

  const jobsQ = useQuery({
    queryKey: ['jobs', tenant.id],
    queryFn: () => platformService.listJobs(tenant.id),
    refetchInterval: (query) => {
      const jobs = query.state.data ?? [];
      const active = jobs.some((j) => j.status === 'pending' || j.status === 'running');
      return active ? JOB_POLL_INTERVAL_MS : false;
    },
  });

  const retry = useMutation({
    mutationFn: (jobId: string) => platformService.retryJob(tenant.id, jobId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs', tenant.id] }),
  });

  const jobs = jobsQ.data ?? [];
  // Hide the panel entirely for tenants with no recorded jobs (e.g. ones
  // provisioned before the durable job queue existed) to avoid clutter.
  if (!jobsQ.isLoading && jobs.length === 0) return null;

  return (
    <div className="border-t border-stone-100 bg-stone-50/50 px-4 py-3">
      <h3 className="mb-2 text-xs font-bold text-stone-600">Provisioning jobs</h3>
      {jobsQ.isLoading && <Spinner label="Loading jobs…" />}
      {jobsQ.isError && <ErrorNote>{apiErrorMessage(jobsQ.error, 'Failed to load jobs.')}</ErrorNote>}
      {retry.error && (
        <div className="mb-2">
          <ErrorNote>{apiErrorMessage(retry.error, 'Failed to retry job.')}</ErrorNote>
        </div>
      )}

      <div className="space-y-2">
        {jobs.map((j) => (
          <JobRow key={j.id} job={j} onRetry={() => retry.mutate(j.id)} retrying={retry.isPending} />
        ))}
      </div>
    </div>
  );
}

function JobRow({ job, onRetry, retrying }: { job: AsyncJob; onRetry: () => void; retrying: boolean }) {
  const canRetry = job.status === 'failed' || job.status === 'dead';
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-stone-700">{job.jobType}</span>
        <Badge color={JOB_STATUS_COLOR[job.status]}>{job.status}</Badge>
      </div>
      {job.progress?.step && (
        <p className="mt-1 text-2xs text-stone-400">Step: {job.progress.step}</p>
      )}
      {job.lastError && <p className="mt-1 text-2xs text-red-500">{job.lastError}</p>}
      <p className="mt-1 text-2xs text-stone-400">
        Attempt {job.attempts}/{job.maxAttempts} · updated {new Date(job.updatedAt).toLocaleString()}
      </p>
      {canRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          aria-label={`Retry ${job.jobType} job`}
          className="mt-2 inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-label font-semibold text-stone-950 disabled:opacity-50"
        >
          <RefreshCw className={`size-3 ${retrying ? 'animate-spin' : ''}`} />
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      )}
    </div>
  );
}

function InvitesPanel({ tenant }: { tenant: Tenant }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState<string | null>(null);
  const [hours, setHours] = useState(24);

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

  // Hide resend when there are no invites at all, or every invite has been accepted.
  const hideResend =
    invitesQ.data !== undefined &&
    (invitesQ.data.length === 0 || invitesQ.data.every((inv) => inv.status === 'accepted'));

  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
  };

  return (
    <div className="border-t border-stone-100 bg-stone-50/50 px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold text-stone-600">Invites</h3>
        {!hideResend && (
          <div className="flex items-center gap-2">
            <label className="text-label font-semibold text-stone-500">
              Expires in (h)
              <input
                type="number"
                min={1}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value) || 24)}
                aria-label="Resend expiry in hours"
                className="ml-1.5 w-16 rounded border border-stone-300 px-1.5 py-1 text-xs"
              />
            </label>
            <button
              type="button"
              onClick={() => resend.mutate()}
              disabled={resend.isPending}
              className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-label font-semibold text-stone-950 disabled:opacity-50"
            >
              <RefreshCw className={`size-3 ${resend.isPending ? 'animate-spin' : ''}`} />
              {resend.isPending ? 'Sending…' : 'Resend invite'}
            </button>
          </div>
        )}
      </div>

      {invitesQ.isLoading && <Spinner label="Loading invites…" />}
      {invitesQ.error && <ErrorNote>{apiErrorMessage(invitesQ.error)}</ErrorNote>}
      {resend.error && <div className="mb-2"><ErrorNote>{apiErrorMessage(resend.error)}</ErrorNote></div>}
      {resentNote && (
        <p className="mb-2 rounded-lg bg-brand/15 px-3 py-2 text-label font-medium text-stone-600">{resentNote}</p>
      )}
      {invitesQ.data && invitesQ.data.length === 0 && (
        <EmptyState>No invites yet.</EmptyState>
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
                <code className="flex-1 truncate rounded bg-stone-100 px-2 py-1 text-label text-stone-600">{inv.token}</code>
                <button type="button" onClick={() => copy(inv.token, `key-${inv.id}`)} aria-label="Copy invite key" className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700">
                  <Copy className="size-3.5" />
                </button>
                <button type="button" onClick={() => copy(inv.inviteLink, `link-${inv.id}`)} className="rounded-md border border-stone-200 px-2 py-1 text-2xs font-semibold text-stone-500 hover:bg-stone-100">
                  {copied === `link-${inv.id}` ? 'Link copied' : copied === `key-${inv.id}` ? 'Key copied' : 'Copy link'}
                </button>
              </div>
              <p className="mt-1.5 text-2xs text-stone-400">
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
