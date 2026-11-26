import { cn } from '@/lib/utils';
import { tenantAvatarClass, tenantInitials } from '@/lib/tenantDisplay';

/** Initials tile in the tenant's status colour (same palette as Onboarding). */
export function TenantAvatar({ name, status, large }: { name: string; status: string; large?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center font-bold text-white',
        large ? 'size-12 rounded-2xl text-sm' : 'size-8 rounded-lg text-2xs',
        tenantAvatarClass(status),
      )}
    >
      {tenantInitials(name)}
    </span>
  );
}
