import { UserPlus, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Navigate } from 'react-router-dom';
import { platformService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { useAuthStore } from '@/store/useAuthStore';
import { Badge, Spinner, ErrorNote, EmptyState } from '@/components/tenant/ui';

const STATUS_COLOR: Record<string, string> = {
  active: '#22c55e',
  provisioning: '#f59e0b',
  invited: '#3b82f6',
  suspended: '#a8a29e',
  deleted: '#ef4444',
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
                Provision isolated customer workspaces and send onboarding invites.
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

          {tenants.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-stone-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-[11px] uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Company</th>
                    <th className="px-4 py-2.5 font-semibold">Slug</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                    <th className="px-4 py-2.5 font-semibold">Database</th>
                    <th className="px-4 py-2.5 font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {tenants.map((t) => (
                    <tr key={t.id} className="hover:bg-stone-50/60">
                      <td className="px-4 py-2.5 font-semibold text-stone-800">{t.displayName}</td>
                      <td className="px-4 py-2.5 text-stone-500">{t.slug}</td>
                      <td className="px-4 py-2.5">
                        <Badge color={STATUS_COLOR[t.status] ?? undefined}>{t.status}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-stone-500">{t.dbName || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-stone-500">
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
