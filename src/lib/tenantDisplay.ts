import { formatDateValue } from './dateUtils';

const EMPTY_VALUE = '—';
const INITIALS_MAX_WORDS = 2;
const DATE_LOCALE = 'en-US';

// Hex colors for <Badge color>, keyed by tenant / invite status.
export const TENANT_STATUS_COLOR: Record<string, string> = {
  active: '#22c55e',
  provisioning: '#f59e0b',
  submitted: '#8b5cf6',
  invited: '#3b82f6',
  suspended: '#a8a29e',
  rejected: '#ef4444',
  deleted: '#ef4444',
  pending: '#3b82f6',
  accepted: '#22c55e',
};

export const TENANT_MIGRATION_COLOR: Record<string, string> = {
  migrated: '#22c55e',
  pending: '#f59e0b',
  failed: '#ef4444',
};

export const JOB_STATUS_COLOR: Record<string, string> = {
  pending: '#3b82f6',
  running: '#f59e0b',
  succeeded: '#22c55e',
  failed: '#ef4444',
  dead: '#ef4444',
};

// Avatar backgrounds as Tailwind classes (no inline style), same palette as above.
const AVATAR_FALLBACK = 'bg-stone-400';
const TENANT_AVATAR_CLASS: Record<string, string> = {
  active: 'bg-green-500',
  provisioning: 'bg-amber-500',
  submitted: 'bg-violet-500',
  invited: 'bg-blue-500',
  suspended: 'bg-stone-400',
  rejected: 'bg-red-500',
  deleted: 'bg-red-500',
};

export function tenantAvatarClass(status: string): string {
  return TENANT_AVATAR_CLASS[status] ?? AVATAR_FALLBACK;
}

export function tenantDetailPath(tenantId: string): string {
  return `/customer/onboarding/${tenantId}`;
}

export function tenantInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, INITIALS_MAX_WORDS)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase();
}

export function formatTenantDate(iso: string | null | undefined): string {
  if (!iso) return EMPTY_VALUE;
  return formatDateValue(iso, DATE_LOCALE, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTenantDateTime(iso: string | null | undefined): string {
  if (!iso) return EMPTY_VALUE;
  return new Date(iso).toLocaleString(DATE_LOCALE, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
