import { describeTenantMetadata } from '@/lib/tenantMetadata';
import { formatTenantDate, formatTenantDateTime } from '@/lib/tenantDisplay';
import { SectionCard } from '@/components/customer/TenantSectionCard';
import { TenantDetailCell } from '@/components/customer/TenantDetailCell';
import { TenantInvitesPanel } from '@/components/customer/TenantInvitesPanel';
import { TenantJobsPanel } from '@/components/customer/TenantJobsPanel';
import type { Tenant } from '@/types/tenant';

const NOT_SET = '—';

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

/** The customer detail page's General tab: identity, infrastructure,
 *  onboarding details, provisioning jobs and invites. */
export function TenantGeneralTab({ tenant }: { tenant: Tenant }) {
  return (
    <div className="space-y-5">
      <TenantOverview tenant={tenant} />
      <TenantCompanyDetails tenant={tenant} />

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white empty:hidden">
        <TenantJobsPanel tenant={tenant} />
      </div>
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <TenantInvitesPanel tenant={tenant} />
      </div>
    </div>
  );
}
