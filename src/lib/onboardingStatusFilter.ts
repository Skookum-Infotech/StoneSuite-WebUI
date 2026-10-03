import type { Tenant } from '@/types/tenant';

export type OnboardingFilterKey = 'pending' | 'invited' | 'active' | 'suspended';

export interface OnboardingFilter {
  key: OnboardingFilterKey;
  label: string;
  /** Backend tenant statuses this card covers. "Pending" = awaiting approval. */
  statuses: string[];
  /** Tailwind classes for the card's accent dot. */
  dotClass: string;
}

export const ONBOARDING_FILTERS: OnboardingFilter[] = [
  { key: 'pending', label: 'Pending', statuses: ['submitted'], dotClass: 'bg-violet-500' },
  { key: 'invited', label: 'Invited', statuses: ['invited'], dotClass: 'bg-blue-500' },
  { key: 'active', label: 'Active', statuses: ['active'], dotClass: 'bg-green-500' },
  { key: 'suspended', label: 'Suspended', statuses: ['suspended'], dotClass: 'bg-stone-400' },
];

export type OnboardingFilterCounts = Record<OnboardingFilterKey, number>;

export function countByFilter(tenants: Tenant[]): OnboardingFilterCounts {
  const counts: OnboardingFilterCounts = { pending: 0, invited: 0, active: 0, suspended: 0 };
  for (const f of ONBOARDING_FILTERS) {
    counts[f.key] = tenants.filter((t) => f.statuses.includes(t.status)).length;
  }
  return counts;
}

export function filterTenants(tenants: Tenant[], key: OnboardingFilterKey | null): Tenant[] {
  if (key === null) return tenants;
  const filter = ONBOARDING_FILTERS.find((f) => f.key === key);
  if (!filter) return tenants;
  return tenants.filter((t) => filter.statuses.includes(t.status));
}
