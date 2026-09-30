import type { Tenant } from '@/types/tenant';

// Tenant lifecycle statuses the UI branches on. Others ('submitted', 'invited',
// 'rejected', 'deleted') only ever allow a permanent delete.
const STATUS_ACTIVE = 'active';
const STATUS_SUSPENDED = 'suspended';
const STATUS_PROVISIONING = 'provisioning';

export interface TenantActionState {
  canSuspend: boolean;
  canRestore: boolean;
  canPurge: boolean;
  /** The platform owner workspace: nothing destructive is ever offered. */
  isProtected: boolean;
}

/**
 * Which lifecycle buttons a platform admin sees for a tenant. A convenience
 * layer only — the backend enforces the same rules (the platform owner is
 * refused, and a purge is refused while provisioning is running).
 */
export function tenantActionState(
  tenant: Pick<Tenant, 'status'> & { isPlatformOwner?: boolean },
): TenantActionState {
  if (tenant.isPlatformOwner) {
    return { canSuspend: false, canRestore: false, canPurge: false, isProtected: true };
  }
  return {
    canSuspend: tenant.status === STATUS_ACTIVE,
    canRestore: tenant.status === STATUS_SUSPENDED,
    canPurge: tenant.status !== STATUS_PROVISIONING,
    isProtected: false,
  };
}

/**
 * True when what the admin typed is the tenant's slug. Case-sensitive, matching
 * the backend; surrounding whitespace (a stray paste) is forgiven.
 */
export function isPurgeConfirmed(slug: string, typed: string): boolean {
  return slug !== '' && typed.trim() === slug;
}
