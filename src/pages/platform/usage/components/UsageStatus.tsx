import { Badge } from '@/components/tenant/ui';
import { TENANT_STATUS_COLOR } from '@/lib/tenantDisplay';

/** Tenant lifecycle status chip, coloured like the Onboarding page's. */
export function UsageStatus({ status }: { status: string }) {
  return <Badge color={TENANT_STATUS_COLOR[status]}>{status}</Badge>;
}
