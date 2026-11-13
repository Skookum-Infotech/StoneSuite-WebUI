import { useEffect, useRef, type KeyboardEvent } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { platformService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { useAuthStore } from '@/store/useAuthStore';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { tenantAvatarClass, tenantInitials } from '@/lib/tenantDisplay';
import { cn } from '@/lib/utils';
import { Spinner, ErrorNote, EmptyState } from '@/components/tenant/ui';
import { TenantActions } from '@/components/customer/TenantActions';
import { TenantGeneralTab } from '@/components/customer/TenantGeneralTab';
import { TenantSettingsTab } from '@/components/customer/TenantSettingsTab';
import { TenantStatusBadges } from '@/components/customer/TenantStatusBadges';
import { TAB_LIST_CLASS, tabClass } from '@/components/ui/tabStyles';

const CUSTOMERS_PATH = '/customer/onboarding';

// The page's tabs. General is everything about the customer; Settings holds
// per-customer feature controls. The choice lives in ?tab= so it can be linked.
const TABS = [
  { key: 'general', label: 'General' },
  { key: 'settings', label: 'Settings' },
] as const;
type TabKey = (typeof TABS)[number]['key'];
const TAB_PARAM = 'tab';

function toTabKey(raw: string | null): TabKey {
  return TABS.some((t) => t.key === raw) ? (raw as TabKey) : 'general';
}

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
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = toTabKey(searchParams.get(TAB_PARAM));
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectTab = (key: TabKey) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (key === 'general') next.delete(TAB_PARAM);
        else next.set(TAB_PARAM, key);
        return next;
      },
      { replace: true },
    );
  };

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const next = (index + step + TABS.length) % TABS.length;
    selectTab(TABS[next].key);
    tabRefs.current[next]?.focus();
  };

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
                    <span className="font-mono text-label text-stone-500">{tenant.slug}</span>
                  </div>
                </div>
              </div>
              <TenantActions tenant={tenant} onPurged={() => navigate(CUSTOMERS_PATH)} />
            </div>

            <div role="tablist" aria-label="Customer sections" className={TAB_LIST_CLASS}>
              {TABS.map((tab, i) => (
                <button
                  key={tab.key}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  id={`customer-tab-${tab.key}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  aria-controls={`customer-panel-${tab.key}`}
                  tabIndex={activeTab === tab.key ? 0 : -1}
                  onClick={() => selectTab(tab.key)}
                  onKeyDown={(e) => onTabKeyDown(e, i)}
                  className={tabClass(activeTab === tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div
              role="tabpanel"
              id={`customer-panel-${activeTab}`}
              aria-labelledby={`customer-tab-${activeTab}`}
            >
              {activeTab === 'settings' ? <TenantSettingsTab tenant={tenant} /> : <TenantGeneralTab tenant={tenant} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
