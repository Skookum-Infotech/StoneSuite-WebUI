import { useState } from 'react';
import { UserPlus, Plus, Send, Check, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Navigate } from 'react-router-dom';
import { platformService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { useAuthStore } from '@/store/useAuthStore';
import { Spinner, ErrorNote, EmptyState } from '@/components/tenant/ui';
import { InviteCustomerModal } from '@/components/customer/InviteCustomerModal';
import { TenantRow } from '@/components/customer/TenantRow';
import type { Tenant } from '@/types/tenant';

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
