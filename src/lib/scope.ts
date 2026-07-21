import type { Scope } from '@/types/tenant';

/**
 * The permission scopes the platform supports. The `team` scope was retired
 * backend-side (it added a visibility tier nothing used); the model is now
 * two-level.
 */
export const SCOPES: Scope[] = ['all', 'own'];

/** Column-width-friendly labels for the role permission matrix. */
export const SCOPE_LABELS: Record<Scope, string> = {
  all: 'All',
  own: 'Own',
};

/**
 * Coerces a scope string coming off the API into a supported scope.
 *
 * An older tenant's `role_permissions` may still hold a `scope = 'team'` grant.
 * The backend now falls through to the default branch for it — `own` in the
 * record engine, deny in the AI retrieval arm — so it can only ever narrow.
 * The UI must display the same thing rather than offering a scope that no
 * longer exists. Anything unrecognised (including blank) is treated as `own`
 * for the same fail-closed reason.
 */
export function normalizeScope(raw: string | null | undefined): Scope {
  return raw === 'all' ? 'all' : 'own';
}

/**
 * Normalizes the scope list returned by the permission catalog, dropping
 * duplicates a legacy value may collapse into and keeping canonical order.
 * An empty or missing list falls back to the full set.
 */
export function normalizeScopeList(raw: string[] | null | undefined): Scope[] {
  const seen = new Set<Scope>((raw ?? []).map(normalizeScope));
  if (seen.size === 0) return SCOPES;
  return SCOPES.filter((s) => seen.has(s));
}
