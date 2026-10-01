import { useEffect, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { platformService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { useAuthStore } from '@/store/useAuthStore';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { describeTenantMetadata } from '@/lib/tenantMetadata';
import { formatTenantDate, formatTenantDateTime, tenantAvatarClass, tenantInitials } from '@/lib/tenantDisplay';
import { cn } from '@/lib/utils';
import { Spinner, ErrorNote, EmptyState } from '@/components/tenant/ui';
import { TenantActions } from '@/components/customer/TenantActions';
import { TenantDetailCell } from '@/components/customer/TenantDetailCell';
import { TenantInvitesPanel } from '@/components/customer/TenantInvitesPanel';
import { TenantJobsPanel } from '@/components/customer/TenantJobsPanel';
import { TenantStatusBadges } from '@/components/customer/TenantStatusBadges';
import type { Tenant } from '@/types/tenant';

const CUSTOMERS_PATH = '/customer/onboarding';
const NOT_SET = '—';

function BackToCustomers() {
  return (
    <Link
      to={CUSTOMERS_PATH}
      className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-800"
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" /> Back to customers
    </Link>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <h2 className="border-b border-stone-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-stone-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function TenantOverview({ tenant }: { tenant: Tenant }) {
  return (
    <SectionCard title="Overview">
      <div className="grid grid-cols-2 gap-px bg-stone-100 sm:grid-cols-3 lg:grid-cols-5">
        <TenantDetailCell label="Database" value={tenant.dbName || NOT_SET} mono />
        <TenantDetailCell label="Storage bucket" value={tenant.r2Bucket || NOT_SET} mono />
        <TenantDetailCell label="DB migration" value={tenant.migrationStatus || NOT_SET} />
        <TenantDetailCell label="Onboarded" value={formatTenantDateTime(tenant.createdAt)} />
        <TenantDetailCell
          label="Auto-delete after"
          value={tenant.hardDeleteAfter ? formatTenantDate(tenant.hardDeleteAfter) : 'Not scheduled'}
          dimmed={!tenant.hardDeleteAfter}
        />
      </div>
    </SectionCard>
  );
}

function TenantCompanyDetails({ tenant }: { tenant: Tenant }) {
  const { contactEmail, phone, industry, website, extra } = describeTenantMetadata(tenant.metadata);
  const allCells: Array<[string, string]> = [
    ['Contact email', contactEmail],
    ['Phone', phone],
    ['Industry', industry],
    ['Website', website],
    ...extra.map(([key, value]): [string, string] => [key.replace(/_/g, ' '), value]),
  ];
  const cells = allCells.filter(([, value]) => value !== '');

  if (cells.length === 0) return null;
  return (
    <SectionCard title="Company details">
      <div className="grid grid-cols-2 gap-px bg-stone-100 sm:grid-cols-3 lg:grid-cols-4">
        {cells.map(([label, value]) => (
          <TenantDetailCell key={label} label={label} value={value} />
        ))}
      </div>
    </SectionCard>
  );
}

// Dedicated platform-admin view of one customer (replaces the old expand-in-place
// row): identity, infrastructure, onboarding details, provisioning jobs, invites
// and the suspend / delete controls. Reads the customer from the same ['tenants']
// list the onboarding page already loads — no per-tenant endpoint.
export default function TenantDetailPage() {
  const { tenantId = '' } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);

  const tenantsQ = useQuery({
    queryKey: ['tenants'],
    queryFn: platformService.listTenants,
    enabled: Boolean(user?.isPlatformAdmin),
  });
  const tenant = tenantsQ.data?.find((t) => t.id === tenantId);

  // The breadcrumb must show the customer's name, never the raw UUID segment.
  useEffect(() => {
    if (!tenant?.displayName) return;
    setLabel(tenantId, tenant.displayName);
    return () => clearLabel(tenantId);
  }, [tenantId, tenant?.displayName, setLabel, clearLabel]);

  if (user && !user.isPlatformAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="space-y-5 p-6">
        <BackToCustomers />

        {tenantsQ.isLoading && <Spinner label="Loading customer…" />}
        {tenantsQ.isError && <ErrorNote>{apiErrorMessage(tenantsQ.error, 'Failed to load customer.')}</ErrorNote>}
        {tenantsQ.isSuccess && !tenant && (
          <EmptyState>Customer not found — it may have been deleted.</EmptyState>
        )}

        {tenant && (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex size-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white',
                    tenantAvatarClass(tenant.status),
                  )}
                  aria-hidden="true"
                >
                  {tenantInitials(tenant.displayName)}
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold tracking-tight text-stone-900">{tenant.displayName}</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <TenantStatusBadges tenant={tenant} />
                    <span className="font-mono text-label text-stone-400">{tenant.slug}</span>
                  </div>
                </div>
              </div>
              <TenantActions tenant={tenant} onPurged={() => navigate(CUSTOMERS_PATH)} />
            </div>

            <TenantOverview tenant={tenant} />
            <TenantCompanyDetails tenant={tenant} />

            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white empty:hidden">
              <TenantJobsPanel tenant={tenant} />
            </div>
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <TenantInvitesPanel tenant={tenant} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
