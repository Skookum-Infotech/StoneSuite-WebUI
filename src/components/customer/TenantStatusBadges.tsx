import { Badge } from '@/components/tenant/ui';
import { TENANT_MIGRATION_COLOR, TENANT_STATUS_COLOR } from '@/lib/tenantDisplay';
import type { Tenant } from '@/types/tenant';

const MIGRATION_FALLBACK_COLOR = '#a8a29e';

export function TenantStatusBadges({ tenant }: { tenant: Pick<Tenant, 'status' | 'migrationStatus'> }) {
  return (
    <>
      <Badge color={TENANT_STATUS_COLOR[tenant.status]}>{tenant.status}</Badge>
      {tenant.migrationStatus && (
        <Badge color={TENANT_MIGRATION_COLOR[tenant.migrationStatus] ?? MIGRATION_FALLBACK_COLOR}>
          db {tenant.migrationStatus}
        </Badge>
      )}
    </>
  );
}
