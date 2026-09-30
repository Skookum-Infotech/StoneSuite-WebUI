import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { describeTenantMetadata } from '@/lib/tenantMetadata';
import { formatTenantDate, tenantAvatarClass, tenantDetailPath, tenantInitials } from '@/lib/tenantDisplay';
import { cn } from '@/lib/utils';
import { TenantActions } from '@/components/customer/TenantActions';
import { TenantStatusBadges } from '@/components/customer/TenantStatusBadges';
import type { Tenant } from '@/types/tenant';

// One customer in the onboarding list. The body links to the dedicated details
// page; the lifecycle buttons sit beside the link (never inside it) so neither
// is a nested interactive element.
export function TenantRow({ tenant }: { tenant: Tenant }) {
  const { contactEmail, phone } = describeTenantMetadata(tenant.metadata);

  return (
    <div className="flex items-center gap-2 overflow-hidden rounded-xl border border-stone-200 bg-white pr-3 transition-colors hover:bg-stone-50">
      <Link
        to={tenantDetailPath(tenant.id)}
        aria-label={`View details for ${tenant.displayName}`}
        className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3.5 text-left"
      >
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white',
            tenantAvatarClass(tenant.status),
          )}
          aria-hidden="true"
        >
          {tenantInitials(tenant.displayName)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-stone-900">{tenant.displayName}</p>
            <TenantStatusBadges tenant={tenant} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="font-mono text-label text-stone-400">{tenant.slug}</span>
            {contactEmail && <span className="text-label text-stone-500">{contactEmail}</span>}
            {phone && <span className="text-label text-stone-500">{phone}</span>}
          </div>
        </div>

        <div className="hidden shrink-0 flex-col items-end gap-0.5 sm:flex">
          <span className="text-label text-stone-400">{formatTenantDate(tenant.createdAt)}</span>
          {tenant.dbName && <span className="font-mono text-2xs text-stone-300">{tenant.dbName}</span>}
        </div>

        <ChevronRight className="size-4 shrink-0 text-stone-300" aria-hidden="true" />
      </Link>

      <TenantActions tenant={tenant} />
    </div>
  );
}
